import { Clerk } from "@clerk/clerk-js";
import "./styles.css";

const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

/** Digits only, with country code (e.g. 9779812345678). Set `VITE_WHATSAPP_NUMBER` in `.env` */
const whatsappNumber = String(import.meta.env.VITE_WHATSAPP_NUMBER ?? "").replace(/\D/g, "");
const whatsappChatUrl = whatsappNumber
  ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent("Hi tusabysmriti — I'd like to ask about a bespoke piece.")}`
  : "";

/**
 * Your photos live in `public/assets/` and are served at `/assets/...`.
 * See `public/assets/README.md` for suggested filenames and sizes.
 */
const SITE_IMAGES = {
  hero: "/assets/hero.jpg",
  /** Same pose / garment as the hero photo — used for the swipe-to-compare control */
  heroSketch: "/assets/hero-sketch.jpg",
  sketchVision: "/assets/sketch-vision.jpg",
  sketchStructure: "/assets/sketch-structure.jpg",
  journey1: "/assets/journey-1.jpg",
  journey2: "/assets/journey-2.jpg",
  journey3: "/assets/journey-3.jpg",
  journey4: "/assets/journey-4.jpg",
  portfolioCrimson: "/assets/portfolio-crimson.jpg",
  portfolioHeritage: "/assets/portfolio-heritage.jpg",
  portfolioIvory: "/assets/portfolio-ivory.jpg",
};

/** Portfolio swipe carousel — image + card copy for each design */
const PORTFOLIO_ITEMS = [
  {
    src: SITE_IMAGES.portfolioCrimson,
    alt: "Bridal saree editorial",
    title: "The Crimson Bride",
    detail: "Hand-spun silk",
  },
  {
    src: SITE_IMAGES.portfolioHeritage,
    alt: "Daura Suruwal tailoring detail",
    title: "Groom's Heritage",
    detail: "Tailored Dhaka",
  },
  {
    src: SITE_IMAGES.portfolioIvory,
    alt: "Pasni ceremonial outfit",
    title: "Ceremonial Ivory",
    detail: "Raw silk",
  },
];

let clerk = null;
let authLoadError = null;
let activeUserId = null;
let currentView = "home";

/** Tear down hero compare listeners before re-render */
let unbindHeroCompare = null;

/** Tear down portfolio carousel listeners before re-render */
let unbindPortfolioCarousel = null;

function loadClerkUiBundle(publishableKey) {
  const clerkDomain = atob(publishableKey.split("_")[2]).slice(0, -1);
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://${clerkDomain}/npm/@clerk/ui@1/dist/ui.browser.js`;
    script.async = true;
    script.crossOrigin = "anonymous";
    script.onload = resolve;
    script.onerror = () => reject(new Error("Failed to load @clerk/ui bundle"));
    document.head.appendChild(script);
  });
}

const products = [
  {
    id: "linen-drape-dress",
    name: "Linen Drape Dress",
    category: "Made to order",
    price: 148,
    tone: "Oat",
  },
  {
    id: "soft-wrap-top",
    name: "Soft Wrap Top",
    category: "Hand finished",
    price: 84,
    tone: "Bone",
  },
  {
    id: "studio-trouser",
    name: "Studio Trouser",
    category: "Small batch",
    price: 126,
    tone: "Sand",
  },
];

const cart = new Map();

function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function getCartTotal() {
  return [...cart.values()].reduce(
    (total, item) => total + item.product.price * item.quantity,
    0,
  );
}

function getCartCount() {
  return [...cart.values()].reduce((total, item) => total + item.quantity, 0);
}

function addToCart(productId) {
  const product = products.find((item) => item.id === productId);

  if (!product) {
    return;
  }

  const existing = cart.get(productId);
  cart.set(productId, {
    product,
    quantity: existing ? existing.quantity + 1 : 1,
  });

  renderCart();
}

function isSignedIn() {
  return Boolean(clerk?.user);
}

function getPrimaryEmail() {
  return clerk?.user?.primaryEmailAddress?.emailAddress ?? "";
}

function navigateTo(view) {
  // First publish: waitlist route disabled — treat as home if something still links to it
  if (view === "waitlist") {
    view = "home";
  }
  currentView = view;
  renderApp();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function scrollToSection(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
}

function bindScrollLinks() {
  document.querySelectorAll("[data-scroll-to]").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      const id = el.dataset.scrollTo;
      if (!id) return;
      if (currentView !== "home") {
        navigateTo("home");
        setTimeout(() => scrollToSection(id), 120);
      } else {
        scrollToSection(id);
      }
    });
  });
}

function renderCheckoutAuth() {
  if (!clerkPublishableKey) {
    return `
      <div class="rounded-lg border border-outline-variant/40 bg-surface-container-low p-6 text-left">
        <h3 class="font-headline-md text-headline-md text-primary mb-2">Connect Clerk to enable accounts</h3>
        <p class="text-secondary font-body-md mb-3">
          Run <code class="rounded bg-secondary-fixed px-1 py-0.5 text-sm">clerk init</code> or add your publishable key to
          <code class="rounded bg-secondary-fixed px-1 py-0.5 text-sm">.env</code>, then restart Vite.
        </p>
        <code class="block rounded bg-secondary-fixed px-3 py-2 text-sm">VITE_CLERK_PUBLISHABLE_KEY=pk_test_...</code>
      </div>
    `;
  }

  if (authLoadError) {
    return `
      <div class="rounded-lg border border-error/30 bg-error-container/30 p-6 text-left">
        <h3 class="font-headline-md text-headline-md text-primary mb-2">Clerk could not load</h3>
        <p class="text-secondary">${authLoadError}</p>
      </div>
    `;
  }

  if (!isSignedIn()) {
    return `
      <div class="rounded-lg border border-outline-variant/40 bg-background p-6 text-left">
        <h3 class="font-headline-md text-headline-md text-primary mb-2">Sign in to check out</h3>
        <p class="text-secondary font-body-md mb-4">
          Create or access your tusabysmriti account before continuing with shipping.
        </p>
        <div data-auth-checkout></div>
      </div>
    `;
  }

  return `
    <form class="checkout-form grid gap-4 text-left">
      <label class="grid gap-2 font-label-sm text-label-sm uppercase tracking-wide text-secondary">
        Email for order updates
        <input type="email" value="${getPrimaryEmail()}" readonly class="w-full border border-outline-variant/50 bg-surface-container-lowest px-4 py-3 text-body-md text-on-surface focus:border-primary focus:ring-0" />
      </label>
      <label class="grid gap-2 font-label-sm text-label-sm uppercase tracking-wide text-secondary">
        Shipping address
        <input type="text" placeholder="Street, city, state" class="w-full border border-outline-variant/50 bg-transparent px-4 py-3 text-body-md focus:border-primary focus:ring-0" />
      </label>
      <button type="button" class="w-full bg-primary px-6 py-4 font-label-sm text-label-sm uppercase tracking-[0.2em] text-on-primary transition-opacity hover:opacity-90">
        Continue checkout
      </button>
    </form>
  `;
}

function renderProducts() {
  const tones = [
    "from-secondary-container/40 to-surface-dim/60",
    "from-secondary-fixed-dim/50 to-secondary-container/40",
    "from-outline-variant/30 to-secondary-fixed/50",
  ];

  return products
    .map(
      (product, index) => `
        <article class="group cursor-pointer reveal">
          <div class="relative mb-6 aspect-[4/5] overflow-hidden">
            <div class="absolute inset-0 bg-gradient-to-br ${tones[index % tones.length]}" aria-hidden="true"></div>
            <span class="font-display-lg absolute bottom-6 left-6 text-6xl font-medium text-primary/20">${product.tone}</span>
            <div class="absolute inset-0 flex items-center justify-center bg-primary/10 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
              <button type="button" data-add-to-cart="${product.id}" class="font-label-sm text-label-sm uppercase tracking-widest text-on-primary">
                Add to bag
              </button>
            </div>
          </div>
          <div class="flex items-start justify-between gap-4">
            <div>
              <h5 class="font-headline-md text-headline-md text-primary">${product.name}</h5>
              <div class="mt-1 flex items-center gap-2">
                <span class="h-1.5 w-1.5 rounded-full bg-tertiary"></span>
                <span class="font-label-sm text-label-sm uppercase text-secondary">${product.category}</span>
              </div>
            </div>
            <strong class="font-headline-md text-headline-md text-primary whitespace-nowrap">${formatCurrency(product.price)}</strong>
          </div>
        </article>
      `,
    )
    .join("");
}

function renderCart() {
  const cartItems = document.querySelector("[data-cart-items]");
  const cartCounts = document.querySelectorAll("[data-cart-count]");
  const cartTotal = document.querySelector("[data-cart-total]");

  if (!cartItems || !cartCounts.length || !cartTotal) {
    return;
  }

  cartCounts.forEach((cartCount) => {
    cartCount.textContent = getCartCount();
  });
  cartTotal.textContent = formatCurrency(getCartTotal());

  if (cart.size === 0) {
    cartItems.innerHTML = `
      <p class="text-secondary font-body-md py-4 text-center">
        Your bag is waiting for a handmade piece.
      </p>
    `;
    return;
  }

  cartItems.innerHTML = [...cart.values()]
    .map(
      ({ product, quantity }) => `
        <div class="flex justify-between gap-4 font-body-md text-secondary">
          <span>${quantity} × ${product.name}</span>
          <strong class="text-primary">${formatCurrency(product.price * quantity)}</strong>
        </div>
      `,
    )
    .join("");
}

function renderProfileView() {
  if (!clerkPublishableKey) {
    return `
      <section class="mx-auto max-w-container-max px-margin-mobile py-24 md:px-margin-desktop">
        <div class="rounded-lg border border-outline-variant/40 bg-surface-container-low p-8">
          <h3 class="font-headline-md text-headline-md text-primary mb-2">Connect Clerk to enable profiles</h3>
          <p class="text-secondary font-body-md mb-3">
            Run <code class="rounded bg-secondary-fixed px-1 py-0.5 text-sm">clerk init</code> or add your publishable key to
            <code class="rounded bg-secondary-fixed px-1 py-0.5 text-sm">.env</code>, then restart Vite.
          </p>
          <code class="block rounded bg-secondary-fixed px-3 py-2 text-sm">VITE_CLERK_PUBLISHABLE_KEY=pk_test_...</code>
        </div>
      </section>
    `;
  }

  if (authLoadError) {
    return `
      <section class="mx-auto max-w-container-max px-margin-mobile py-24 md:px-margin-desktop">
        <div class="rounded-lg border border-error/30 bg-error-container/30 p-8">
          <h3 class="font-headline-md text-headline-md text-primary mb-2">Clerk could not load</h3>
          <p class="text-secondary">${authLoadError}</p>
        </div>
      </section>
    `;
  }

  if (!isSignedIn()) {
    return `
      <section class="mx-auto max-w-container-max px-margin-mobile py-24 md:px-margin-desktop">
        <div class="mb-10 max-w-xl">
          <span class="font-label-sm text-label-sm uppercase text-primary tracking-widest">Your account</span>
          <h2 class="font-display-lg text-display-lg-mobile md:text-display-lg mt-4 text-primary leading-tight">Sign in to view your profile</h2>
          <p class="mt-4 font-body-lg text-body-lg text-secondary">Access your tusabysmriti account to manage your details, security settings, and preferences.</p>
        </div>
        <div class="max-w-md rounded-lg border border-outline-variant/30 bg-background p-8">
          <div data-profile-signin></div>
        </div>
      </section>
    `;
  }

  return `
    <section class="mx-auto max-w-container-max px-margin-mobile py-24 md:px-margin-desktop">
      <div class="mb-10">
        <span class="font-label-sm text-label-sm uppercase text-primary tracking-widest">Your account</span>
        <h2 class="font-display-lg text-display-lg-mobile md:text-display-lg mt-4 text-primary leading-tight">Manage your profile</h2>
        <p class="mt-4 max-w-xl font-body-lg text-body-lg text-secondary">Update your personal details, security settings, and connected accounts.</p>
      </div>
      <div class="profile-container min-h-[400px]" data-user-profile></div>
    </section>
  `;
}

function renderWaitlistView() {
  if (!clerkPublishableKey) {
    return `
      <section class="mx-auto max-w-container-max px-margin-mobile py-24 md:px-margin-desktop">
        <div class="rounded-lg border border-outline-variant/40 bg-surface-container-low p-8">
          <h3 class="font-headline-md text-headline-md text-primary mb-2">Connect Clerk to enable the waitlist</h3>
          <p class="text-secondary font-body-md mb-3">
            Run <code class="rounded bg-secondary-fixed px-1 py-0.5 text-sm">clerk init</code> or add your publishable key to
            <code class="rounded bg-secondary-fixed px-1 py-0.5 text-sm">.env</code>, then restart Vite.
          </p>
          <code class="block rounded bg-secondary-fixed px-3 py-2 text-sm">VITE_CLERK_PUBLISHABLE_KEY=pk_test_...</code>
        </div>
      </section>
    `;
  }

  if (authLoadError) {
    return `
      <section class="mx-auto max-w-container-max px-margin-mobile py-24 md:px-margin-desktop">
        <div class="rounded-lg border border-error/30 bg-error-container/30 p-8">
          <h3 class="font-headline-md text-headline-md text-primary mb-2">Clerk could not load</h3>
          <p class="text-secondary">${authLoadError}</p>
        </div>
      </section>
    `;
  }

  return `
    <section class="mx-auto max-w-container-max px-margin-mobile py-24 md:px-margin-desktop">
      <div class="grid gap-16 md:grid-cols-12 md:items-start">
        <div class="md:col-span-7 space-y-6">
          <span class="font-label-sm text-label-sm uppercase text-primary tracking-widest">Early access</span>
          <h2 class="font-display-lg text-display-lg-mobile md:text-display-lg text-primary leading-tight">Join the waitlist</h2>
          <p class="font-body-lg text-body-lg text-secondary max-w-xl">
            Our next collection is coming soon. Be the first to know when new handmade pieces are available — no spam, just a quiet heads-up when something beautiful is ready.
          </p>
          <div class="space-y-6 border-t border-outline-variant/30 pt-8">
            <div>
              <span class="font-label-sm text-label-sm uppercase text-tertiary">Priority access</span>
              <p class="mt-2 font-body-md text-secondary">Waitlist members get 24-hour early access to new drops.</p>
            </div>
            <div>
              <span class="font-label-sm text-label-sm uppercase text-tertiary">Behind the scenes</span>
              <p class="mt-2 font-body-md text-secondary">Occasional updates on fabric sourcing and studio process.</p>
            </div>
            <div>
              <span class="font-label-sm text-label-sm uppercase text-tertiary">Limited runs</span>
              <p class="mt-2 font-body-md text-secondary">Each piece is made in small batches with archival care.</p>
            </div>
          </div>
        </div>
        <div class="md:col-span-5">
          <div class="sticky top-28 rounded-lg border border-outline-variant/40 bg-background p-8 editorial-shadow">
            <div data-clerk-waitlist></div>
          </div>
        </div>
      </div>
    </section>
  `;
}

function renderPortfolioCarouselSection() {
  const slidesHtml = PORTFOLIO_ITEMS.map(
    (item, index) => `
        <article
          data-portfolio-slide="${index}"
          class="group snap-center shrink-0 w-[min(85vw,400px)] border-[0.5px] border-outline-variant/40 bg-background editorial-shadow transition-shadow duration-300 hover:shadow-[0_8px_30px_-8px_rgba(97,0,0,0.12)]"
        >
          <div class="relative aspect-[4/5] overflow-hidden border-b border-outline-variant/20">
            <img
              class="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
              alt="${item.alt}"
              src="${item.src}"
              loading="lazy"
            />
            <div class="pointer-events-none absolute inset-0 flex items-center justify-center bg-primary/10 opacity-0 transition-opacity group-hover:opacity-100">
              <span class="font-label-sm text-label-sm uppercase tracking-widest text-on-primary">View details</span>
            </div>
          </div>
          <div class="p-6">
            <h3 class="font-headline-md text-headline-md text-primary">${item.title}</h3>
            <div class="mt-2 flex items-center gap-2">
              <span class="h-1.5 w-1.5 shrink-0 rounded-full bg-tertiary" aria-hidden="true"></span>
              <span class="font-label-sm text-label-sm uppercase text-secondary">${item.detail}</span>
            </div>
          </div>
        </article>`,
  ).join("");

  const dotsHtml = PORTFOLIO_ITEMS.map(
    (_, index) => `
        <button
          type="button"
          data-portfolio-dot="${index}"
          class="portfolio-carousel-dot h-2 w-2 shrink-0 rounded-full bg-outline-variant/45 transition-all duration-300 hover:bg-outline-variant aria-[current=true]:w-6 aria-[current=true]:bg-primary"
          aria-label="Show design ${index + 1} of ${PORTFOLIO_ITEMS.length}"
          aria-current="false"
        ></button>`,
  ).join("");

  return `
    <section id="portfolio" class="mx-auto max-w-container-max px-margin-mobile py-24 md:px-margin-desktop md:py-32 scroll-mt-24">
      <div class="mb-10 flex flex-col items-end justify-between gap-6 md:mb-14 md:flex-row">
        <div class="max-w-xl">
          <span class="font-label-sm text-label-sm uppercase text-primary tracking-widest mb-4 block">The collections</span>
          <h2 class="font-display-lg text-display-lg-mobile md:text-display-lg text-primary leading-tight">Portfolio highlights</h2>
          <p class="mt-4 max-w-md font-body-md text-secondary md:hidden">Swipe sideways to browse dress designs — each piece is a finished bespoke work.</p>
        </div>
        <div class="flex w-full flex-col items-stretch gap-4 md:w-auto md:items-end">
          <p class="hidden max-w-xs font-body-md text-secondary md:block md:text-right">A curated gallery of finished works for weddings, Pasni, and special events.</p>
          <div class="flex items-center justify-between gap-4 md:justify-end">
            <p class="font-label-sm text-label-sm uppercase tracking-widest text-secondary md:hidden">Swipe</p>
            <div class="flex items-center gap-2">
              <button
                type="button"
                data-portfolio-prev
                class="flex h-11 w-11 items-center justify-center rounded-full border border-outline-variant/50 text-primary transition-colors hover:border-primary hover:bg-primary hover:text-on-primary disabled:pointer-events-none disabled:opacity-30"
                aria-label="Previous portfolio design"
              >
                <span class="material-symbols-outlined text-[22px] leading-none">chevron_left</span>
              </button>
              <button
                type="button"
                data-portfolio-next
                class="flex h-11 w-11 items-center justify-center rounded-full border border-outline-variant/50 text-primary transition-colors hover:border-primary hover:bg-primary hover:text-on-primary disabled:pointer-events-none disabled:opacity-30"
                aria-label="Next portfolio design"
              >
                <span class="material-symbols-outlined text-[22px] leading-none">chevron_right</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="-mx-margin-mobile md:mx-0">
        <div
          data-portfolio-carousel
          class="portfolio-carousel-track flex gap-6 overflow-x-auto overflow-y-hidden overscroll-x-contain scroll-smooth px-margin-mobile pb-4 pt-1 snap-x snap-mandatory md:px-0"
          tabindex="0"
          role="region"
          aria-roledescription="carousel"
          aria-label="Portfolio dress designs"
        >
          ${slidesHtml}
        </div>
      </div>

      <div class="mt-6 flex justify-center gap-2 md:mt-8" data-portfolio-dots aria-label="Portfolio carousel pages">
        ${dotsHtml}
      </div>
    </section>`;
}

function renderHomeContent() {
  return `
    <section class="relative mx-auto flex min-h-[90vh] max-w-container-max items-center overflow-hidden px-margin-mobile py-24 md:px-margin-desktop" aria-labelledby="hero-title">
      <div class="grid w-full grid-cols-1 items-center gap-gutter md:grid-cols-12">
        <div class="z-10 space-y-8 md:col-span-5">
          <div class="inline-block border-b border-primary/30 pb-2">
            <span class="font-label-sm text-label-sm uppercase text-primary">Made with love in Kathmandu</span>
          </div>
          <h1 id="hero-title" class="font-display-lg text-display-lg-mobile md:text-display-lg leading-none text-primary">
            Trust the Process.<br />
            <span class="font-normal italic">Own the Heritage.</span>
          </h1>
          <p class="font-body-lg text-body-lg text-secondary max-w-md">
            Five years of artisanal mastery, blending the soul of Himalayan tradition with the silhouette of modern fashion — handmade in Nepal with patience and love.
          </p>
          <div class="pt-4 flex flex-wrap gap-4">
            <button type="button" data-scroll-to="shop" class="bg-primary px-8 py-4 font-label-sm text-label-sm uppercase tracking-[0.2em] text-on-primary transition-opacity hover:opacity-90">
              Start your custom journey
            </button>
            <button type="button" data-scroll-to="sketch" class="border border-primary px-8 py-4 font-label-sm text-label-sm uppercase tracking-[0.2em] text-primary transition-all hover:bg-primary hover:text-on-primary">
              Read our story
            </button>
          </div>
        </div>
        <div class="relative mt-12 h-[520px] md:col-span-7 md:mt-0 md:h-[700px]">
          <div class="absolute inset-0 -rotate-3 translate-x-4 translate-y-4 bg-secondary-container/10" aria-hidden="true"></div>
          <div
            class="editorial-shadow relative z-0 h-full w-full overflow-hidden shadow-none select-none touch-pan-y"
            data-hero-compare
            style="--hero-split-pct: 48%"
            role="group"
            aria-label="Compare the finished portrait with the original sketch. Drag sideways."
          >
            <img
              alt=""
              class="absolute inset-0 z-0 h-full w-full object-cover grayscale-[20%]"
              src="${SITE_IMAGES.hero}"
              loading="eager"
              draggable="false"
            />
            <img
              alt=""
              class="pointer-events-none absolute inset-0 z-[1] h-full w-full object-cover grayscale-[20%]"
              src="${SITE_IMAGES.heroSketch}"
              loading="eager"
              draggable="false"
              style="clip-path: inset(0 calc(100% - var(--hero-split-pct)) 0 0)"
            />
            <div
              class="pointer-events-none absolute inset-y-0 z-[2] w-0.5 bg-white/95 shadow-md"
              style="left: var(--hero-split-pct); transform: translateX(-50%)"
              aria-hidden="true"
            ></div>
            <button
              type="button"
              class="absolute top-1/2 z-[3] flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize items-center justify-center rounded-full border-2 border-white bg-primary text-on-primary shadow-lg outline-none ring-offset-2 ring-offset-background focus-visible:ring-2 focus-visible:ring-primary"
              style="left: var(--hero-split-pct)"
              aria-label="Drag to compare sketch and finished photo"
              aria-valuemin="0"
              aria-valuemax="100"
              aria-valuenow="48"
              data-hero-compare-handle
            >
              <span class="material-symbols-outlined text-[22px]" aria-hidden="true">compare</span>
            </button>
            <div class="pointer-events-none absolute inset-x-0 bottom-0 z-[2] flex justify-between bg-gradient-to-t from-black/55 to-transparent px-4 pb-3 pt-10 font-label-sm text-label-sm uppercase tracking-widest text-white">
              <span>Sketch</span>
              <span>Finished</span>
            </div>
          </div>
          <div class="absolute -bottom-8 -left-8 hidden h-48 w-48 border-[0.5px] border-outline-variant/30 md:block" aria-hidden="true"></div>
        </div>
      </div>
    </section>

    <section id="sketch" class="border-y-[0.5px] border-outline-variant/10 bg-surface-container-low py-24 md:py-32 parchment-texture scroll-mt-24">
      <div class="mx-auto max-w-container-max px-margin-mobile md:px-margin-desktop">
        <div class="mb-16 text-center md:mb-24">
          <h2 class="font-headline-lg text-headline-lg text-primary mb-4">We want you to feel the best during your special days</h2>
          <div class="mx-auto h-[1px] w-24 bg-tertiary-container"></div>
        </div>
        <div class="grid grid-cols-1 items-start gap-16 md:grid-cols-12">
          <div class="space-y-6 md:col-span-4">
            <div class="group relative bg-white p-6 editorial-shadow">
              <img alt="Bridal silhouette sketch" class="aspect-[3/4] w-full object-contain" src="${SITE_IMAGES.sketchVision}" loading="lazy" />
              <div class="absolute right-4 top-4 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <span class="material-symbols-outlined text-sm text-tertiary">push_pin</span>
              </div>
            </div>
          </div>

          <div class="flex h-full flex-col justify-center py-12 text-center md:col-span-4 md:text-left">
            <div class="space-y-8 border-[0.5px] border-primary/5 bg-background p-8 md:p-12">
              <span class="material-symbols-outlined text-4xl text-primary">auto_fix</span>
              <h4 class="font-headline-md text-headline-md italic text-primary">
                "We begin with your story, translate it into a sketch, and meticulously handcraft your piece."
              </h4>
              <p class="font-body-md text-body-md text-secondary">
                 I don't know if you noticed but we don't use AI shortcuts (I have hand drawn all these sketches), no exploited labor, and 100% made in Nepal.
              </p>
              <div class="pt-2">
                <button type="button" data-scroll-to="journey" class="font-label-sm text-label-sm uppercase tracking-widest text-primary border-b border-primary transition-colors hover:text-tertiary">
                  Learn our process
                </button>
              </div>
            </div>
          </div>

          <div class="space-y-6 md:col-span-4 md:mt-24">
            <div class="group relative bg-white p-6 editorial-shadow">
              <img alt="Modern Daura Suruwal sketch" class="aspect-[3/4] w-full object-contain" src="${SITE_IMAGES.sketchStructure}" loading="lazy" />
              <div class="absolute right-4 top-4 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <span class="material-symbols-outlined text-sm text-tertiary">push_pin</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section id="journey" class="mx-auto max-w-container-max px-margin-mobile py-24 md:px-margin-desktop md:py-32 scroll-mt-24">
      <div class="mb-16 text-center md:mb-20">
        <span class="font-label-sm text-label-sm uppercase text-primary tracking-widest">Made in Nepal</span>
        <h2 class="font-display-lg text-display-lg-mobile md:text-display-lg mt-4 text-primary leading-tight">What your journey looks like</h2>
        <p class="mx-auto mt-4 max-w-2xl font-body-lg text-body-lg text-secondary">This occassion is special. So we will 100% meet your expectations even if that means I have to call you several times to finalize things ;)</p>
      </div>
      <div class="grid gap-16">
        <article class="grid items-center gap-10 md:grid-cols-2">
          <div class="overflow-hidden border-[0.5px] border-outline-variant/40 aspect-[4/3]">
            <img src="${SITE_IMAGES.journey1}" alt="Placing your order" class="h-full w-full object-cover transition-transform duration-500 hover:scale-105" loading="lazy" />
          </div>
          <div>
            <span class="inline-flex h-11 w-11 items-center justify-center rounded-full border border-outline-variant/50 font-headline-md text-primary">01</span>
            <h3 class="font-headline-md text-headline-md mt-4 text-primary">You place your order</h3>
            <p class="mt-3 max-w-md font-body-md text-secondary">Pick what you love from the shop and check out. That is all you need to start.</p>
          </div>
        </article>
        <article class="grid items-center gap-10 md:grid-cols-2">
          <div class="overflow-hidden border-[0.5px] border-outline-variant/40 aspect-[4/3] md:order-2">
            <img src="${SITE_IMAGES.journey2}" alt="Discussing your requirements" class="h-full w-full object-cover transition-transform duration-500 hover:scale-105" loading="lazy" />
          </div>
          <div class="md:order-1">
            <span class="inline-flex h-11 w-11 items-center justify-center rounded-full border border-outline-variant/50 font-headline-md text-primary">02</span>
            <h3 class="font-headline-md text-headline-md mt-4 text-primary">We reach out to you</h3>
            <p class="mt-3 max-w-md font-body-md text-secondary">A personal conversation about fit, preferences, and any details you have in mind.</p>
          </div>
        </article>
        <article class="grid items-center gap-10 md:grid-cols-2">
          <div class="overflow-hidden border-[0.5px] border-outline-variant/40 aspect-[4/3]">
            <img src="${SITE_IMAGES.journey3}" alt="Sketching your piece" class="h-full w-full object-cover transition-transform duration-500 hover:scale-105" loading="lazy" />
          </div>
          <div>
            <span class="inline-flex h-11 w-11 items-center justify-center rounded-full border border-outline-variant/50 font-headline-md text-primary">03</span>
            <h3 class="font-headline-md text-headline-md mt-4 text-primary">Your piece is sketched</h3>
            <p class="mt-3 max-w-md font-body-md text-secondary">Hand-drawn from your vision — pencil, paper, and patience. No templates, no AI.</p>
          </div>
        </article>
        <article class="grid items-center gap-10 md:grid-cols-2">
          <div class="overflow-hidden border-[0.5px] border-outline-variant/40 aspect-[4/3] md:order-2">
            <img src="${SITE_IMAGES.journey4}" alt="Fabric shopping and stitching" class="h-full w-full object-cover transition-transform duration-500 hover:scale-105" loading="lazy" />
          </div>
          <div class="md:order-1">
            <span class="inline-flex h-11 w-11 items-center justify-center rounded-full border border-outline-variant/50 font-headline-md text-primary">04</span>
            <h3 class="font-headline-md text-headline-md mt-4 text-primary">Fabric & stitching</h3>
            <p class="mt-3 max-w-md font-body-md text-secondary">Fabric is chosen by hand and stitched start to finish with care in Nepal.</p>
          </div>
        </article>
      </div>
    </section>

    ${/* First publish: portfolio / "The collections" carousel — restore: renderPortfolioCarouselSection() */ ""}

    <section class="bg-primary py-24 text-on-primary md:py-32">
      <div class="mx-auto max-w-container-max px-margin-mobile text-center md:px-margin-desktop">
        <div class="mx-auto max-w-4xl space-y-10">
          <span class="material-symbols-outlined text-6xl opacity-30">format_quote</span>
          <h2 class="font-display-lg text-display-lg-mobile md:text-display-lg leading-tight">
            "You give us your vision; we give you a masterpiece."
          </h2>
          <div class="pt-4">
            <p class="font-label-sm text-label-sm uppercase tracking-[0.3em] opacity-80">Our philosophy</p>
            <p class="mx-auto mt-4 max-w-2xl font-body-lg text-body-lg italic opacity-95">
              At tusabysmriti, trust is the thread that binds us. We believe in a collaborative journey where your heritage becomes the inspiration for the next artisanal breakthrough.
            </p>
          </div>
        </div>
      </div>
    </section>

    <section id="connect" class="mx-auto max-w-container-max px-margin-mobile py-24 md:px-margin-desktop md:py-32 scroll-mt-24">
      <div class="flex flex-col items-center border-[0.5px] border-outline-variant/30 p-10 text-center md:p-24">
        <span class="font-label-sm text-label-sm uppercase text-primary mb-6">Connect with us</span>
        <h2 class="font-headline-lg text-headline-lg text-primary mb-4">Begin your story</h2>
        <p class="mb-8 max-w-lg font-body-md text-secondary">
          ${whatsappChatUrl ? "Message us on WhatsApp for questions and timelines, or share your email for studio updates." : "Share your email for availability and studio updates."}
        </p>
        <div class="w-full max-w-md space-y-6">
          ${whatsappChatUrl ? `
          <a
            href="${whatsappChatUrl}"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex w-full items-center justify-center gap-2 border border-[#25D366] bg-[#25D366]/10 py-4 font-label-sm text-label-sm uppercase tracking-[0.2em] text-primary transition-colors hover:bg-[#25D366]/20"
          >
            <span class="material-symbols-outlined text-[22px]" aria-hidden="true">chat</span>
            Contact via WhatsApp
          </a>
          ` : ""}
          <form class="space-y-6">
          <div>
            <input type="email" placeholder="Your email address" class="w-full border-0 border-b border-primary/20 bg-transparent px-0 py-4 font-label-sm text-label-sm uppercase tracking-widest placeholder:text-secondary-fixed-dim focus:border-primary focus:ring-0" />
          </div>
          <div>
            <button type="button" data-scroll-to="checkout" class="w-full bg-primary py-4 font-label-sm text-label-sm uppercase tracking-[0.2em] text-on-primary transition-opacity hover:opacity-90">
              Open bag & checkout
            </button>
          </div>
        </form>
        </div>
      </div>
    </section>

  `;
}

function renderMainContent() {
  switch (currentView) {
    case "profile":
      return renderProfileView();
    default:
      return renderHomeContent();
  }
}

function bindHeroCompareSlider() {
  unbindHeroCompare?.();

  const root = document.querySelector("[data-hero-compare]");
  const handle = root?.querySelector("[data-hero-compare-handle]");
  if (!root || !handle) {
    unbindHeroCompare = null;
    return;
  }

  let splitPct = 48;
  let dragging = false;

  const setSplit = (pct) => {
    splitPct = Math.min(100, Math.max(0, pct));
    root.style.setProperty("--hero-split-pct", `${splitPct}%`);
    handle.setAttribute("aria-valuenow", String(Math.round(splitPct)));
  };

  const splitFromClientX = (clientX) => {
    const rect = root.getBoundingClientRect();
    if (rect.width <= 0) return splitPct;
    return ((clientX - rect.left) / rect.width) * 100;
  };

  const onPointerMove = (e) => {
    if (!dragging) return;
    setSplit(splitFromClientX(e.clientX));
  };

  const endDrag = (e) => {
    if (!dragging) return;
    dragging = false;
    try {
      root.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    root.removeEventListener("pointermove", onPointerMove);
    root.removeEventListener("pointerup", endDrag);
    root.removeEventListener("pointercancel", endDrag);
  };

  const onPointerDown = (e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    dragging = true;
    root.setPointerCapture(e.pointerId);
    setSplit(splitFromClientX(e.clientX));
    root.addEventListener("pointermove", onPointerMove);
    root.addEventListener("pointerup", endDrag);
    root.addEventListener("pointercancel", endDrag);
    e.preventDefault();
  };

  const onHandleKeydown = (e) => {
    const step = e.shiftKey ? 12 : 5;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      e.preventDefault();
      setSplit(splitPct + step);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      e.preventDefault();
      setSplit(splitPct - step);
    }
  };

  root.addEventListener("pointerdown", onPointerDown);
  handle.addEventListener("keydown", onHandleKeydown);

  unbindHeroCompare = () => {
    root.removeEventListener("pointerdown", onPointerDown);
    root.removeEventListener("pointermove", onPointerMove);
    root.removeEventListener("pointerup", endDrag);
    root.removeEventListener("pointercancel", endDrag);
    handle.removeEventListener("keydown", onHandleKeydown);
    unbindHeroCompare = null;
  };
}

function bindPortfolioCarousel() {
  unbindPortfolioCarousel?.();

  const carousel = document.querySelector("[data-portfolio-carousel]");
  const prevBtn = document.querySelector("[data-portfolio-prev]");
  const nextBtn = document.querySelector("[data-portfolio-next]");
  const dots = [...document.querySelectorAll("[data-portfolio-dot]")];
  const slides = carousel ? [...carousel.querySelectorAll("[data-portfolio-slide]")] : [];

  if (!carousel || slides.length === 0) {
    unbindPortfolioCarousel = null;
    return;
  }

  let rafId = 0;

  const scrollToIndex = (index) => {
    const clamped = Math.max(0, Math.min(slides.length - 1, index));
    slides[clamped].scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    });
  };

  const syncUi = () => {
    const rootRect = carousel.getBoundingClientRect();
    const rootCenter = rootRect.left + rootRect.width / 2;
    let bestIndex = 0;
    let bestDist = Infinity;
    slides.forEach((slide, i) => {
      const rect = slide.getBoundingClientRect();
      const slideCenter = rect.left + rect.width / 2;
      const dist = Math.abs(slideCenter - rootCenter);
      if (dist < bestDist) {
        bestDist = dist;
        bestIndex = i;
      }
    });

    dots.forEach((dot, i) => {
      dot.setAttribute("aria-current", i === bestIndex ? "true" : "false");
    });

    if (prevBtn) prevBtn.disabled = bestIndex === 0;
    if (nextBtn) nextBtn.disabled = bestIndex === slides.length - 1;
  };

  const onScroll = () => {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(() => {
      rafId = 0;
      syncUi();
    });
  };

  const activeIndexNearCenter = () => {
    const rootRect = carousel.getBoundingClientRect();
    const rootCenter = rootRect.left + rootRect.width / 2;
    let active = 0;
    let bestDist = Infinity;
    slides.forEach((slide, i) => {
      const rect = slide.getBoundingClientRect();
      const slideCenter = rect.left + rect.width / 2;
      const dist = Math.abs(slideCenter - rootCenter);
      if (dist < bestDist) {
        bestDist = dist;
        active = i;
      }
    });
    return active;
  };

  const onPrev = () => scrollToIndex(activeIndexNearCenter() - 1);
  const onNext = () => scrollToIndex(activeIndexNearCenter() + 1);

  prevBtn?.addEventListener("click", onPrev);
  nextBtn?.addEventListener("click", onNext);

  const dotHandlers = dots.map((dot, i) => {
    const handler = () => scrollToIndex(i);
    dot.addEventListener("click", handler);
    return { dot, handler };
  });

  carousel.addEventListener("scroll", onScroll, { passive: true });

  const onCarouselKeydown = (e) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      onPrev();
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      onNext();
    }
  };
  carousel.addEventListener("keydown", onCarouselKeydown);

  syncUi();

  unbindPortfolioCarousel = () => {
    prevBtn?.removeEventListener("click", onPrev);
    nextBtn?.removeEventListener("click", onNext);
    dotHandlers.forEach(({ dot, handler }) => dot.removeEventListener("click", handler));
    carousel.removeEventListener("scroll", onScroll);
    carousel.removeEventListener("keydown", onCarouselKeydown);
    if (rafId) cancelAnimationFrame(rafId);
    unbindPortfolioCarousel = null;
  };
}

function bindEvents() {
  document.querySelectorAll("[data-add-to-cart]").forEach((button) => {
    button.addEventListener("click", (e) => {
      e.stopPropagation();
      addToCart(button.dataset.addToCart);
    });
  });

  document.querySelectorAll("[data-open-sign-in]").forEach((button) => {
    button.addEventListener("click", () => {
      clerk?.openSignIn();
    });
  });

  document.querySelectorAll("[data-navigate]").forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      navigateTo(link.dataset.navigate);
    });
  });

  bindScrollLinks();
  bindHeroCompareSlider();
  bindPortfolioCarousel();
}

function mountClerkElements() {
  if (!clerkPublishableKey || authLoadError || !clerk) {
    return;
  }

  const headerAuth = document.querySelector("[data-auth-header]");
  if (headerAuth) {
    if (isSignedIn()) {
      headerAuth.innerHTML = "";
      clerk.mountUserButton(headerAuth);
    } else {
      headerAuth.innerHTML = `
        <button class="auth-link" type="button" data-open-sign-in>
          Sign in
        </button>
      `;
      headerAuth.querySelector("[data-open-sign-in]").addEventListener("click", () => {
        clerk?.openSignIn();
      });
    }
  }

  const checkoutAuth = document.querySelector("[data-auth-checkout]");
  if (checkoutAuth && !isSignedIn()) {
    clerk.mountSignIn(checkoutAuth);
  }

  const userProfile = document.querySelector("[data-user-profile]");
  if (userProfile && isSignedIn()) {
    clerk.mountUserProfile(userProfile);
  }

  const profileSignin = document.querySelector("[data-profile-signin]");
  if (profileSignin && !isSignedIn()) {
    clerk.mountSignIn(profileSignin);
  }

  // First publish: waitlist removed — restore when ready:
  // const waitlistEl = document.querySelector("[data-clerk-waitlist]");
  // if (waitlistEl) {
  //   clerk.mountWaitlist(waitlistEl);
  // }
}

function renderHeader() {
  return `
  <header class="sticky top-0 z-50 w-full border-b-[0.5px] border-outline-variant/20 bg-background">
    <nav class="mx-auto flex max-w-container-max flex-wrap items-center justify-between gap-x-4 gap-y-3 px-margin-mobile py-gutter md:px-margin-desktop" aria-label="Main navigation">
      <a href="#" data-navigate="home" class="font-headline-lg text-headline-lg tracking-tight text-primary" aria-label="tusabysmriti home">tusabysmriti</a>
      <div class="order-last flex w-full flex-wrap items-center justify-center gap-x-6 gap-y-2 border-t border-outline-variant/10 pt-3 md:order-none md:w-auto md:border-0 md:pt-0">
        <button type="button" data-scroll-to="sketch" class="font-body-md text-sm font-medium text-secondary transition-colors hover:text-primary md:text-base">Our process</button>
        <button type="button" data-scroll-to="shop" class="font-body-md text-sm font-medium text-secondary transition-colors hover:text-primary md:text-base">Shop</button>
        <a href="#" data-navigate="profile" class="font-body-md text-sm font-medium text-secondary transition-colors hover:text-primary md:text-base">Account</a>
      </div>
      <div class="flex flex-wrap items-center justify-end gap-2 md:gap-4">
        <div data-auth-header></div>
        <button type="button" data-scroll-to="checkout" class="font-label-sm text-label-sm uppercase tracking-wide text-secondary transition-colors hover:text-primary">
          Bag <span data-cart-count>0</span>
        </button>
        <button type="button" data-scroll-to="connect" class="scale-95 bg-primary px-4 py-2.5 font-label-sm text-label-sm uppercase tracking-widest text-on-primary transition-transform active:scale-90 md:px-6 md:py-3">
          Book a consultation
        </button>
      </div>
    </nav>
  </header>
  `;
}

function renderFooter() {
  return `
  <footer class="w-full border-t-[0.5px] border-tertiary/20 bg-surface py-16">
    <div class="mx-auto grid max-w-container-max grid-cols-1 gap-gutter px-margin-mobile md:grid-cols-12 md:px-margin-desktop">
      <div class="space-y-6 md:col-span-4">
        <div class="font-headline-md text-headline-md text-primary">tusabysmriti</div>
        <p class="max-w-xs font-body-md text-secondary">
          Crafting modern Himalayan fusion couture for those who honor tradition and embrace the contemporary.
        </p>
      </div>
      <div class="space-y-4 md:col-span-2">
        <p class="font-label-sm text-label-sm mb-6 font-bold uppercase text-primary">Atelier</p>
        <ul class="space-y-3 font-body-md text-secondary">
          <li><button type="button" data-scroll-to="sketch" class="text-left transition-colors hover:text-primary">The story</button></li>
          <li><button type="button" data-scroll-to="journey" class="text-left transition-colors hover:text-primary">Craftsmanship</button></li>
          <li><button type="button" data-scroll-to="connect" class="text-left transition-colors hover:text-primary">Contact us</button></li>
        </ul>
      </div>
      <div class="space-y-4 md:col-span-2">
        <p class="font-label-sm text-label-sm mb-6 font-bold uppercase text-primary">Account</p>
        <ul class="space-y-3 font-body-md text-secondary">
          <li><a href="#" data-navigate="profile" class="transition-colors hover:text-primary">Profile</a></li>
          <li><button type="button" data-scroll-to="checkout" class="text-left transition-colors hover:text-primary">Shopping bag</button></li>
        </ul>
      </div>
      <div class="flex flex-col justify-between md:col-span-4 md:items-end">
        <div class="mb-8 flex flex-wrap gap-6 md:mb-0">
          ${whatsappChatUrl ? `<a href="${whatsappChatUrl}" target="_blank" rel="noopener noreferrer" class="text-secondary transition-colors hover:text-primary" aria-label="WhatsApp"><span class="material-symbols-outlined">chat</span></a>` : ""}
          <a href="#" class="text-secondary transition-colors hover:text-primary" aria-label="Instagram"><span class="material-symbols-outlined">photo_camera</span></a>
          <a href="#" class="text-secondary transition-colors hover:text-primary" aria-label="Facebook"><span class="material-symbols-outlined">public</span></a>
          <a href="#" class="text-secondary transition-colors hover:text-primary" aria-label="Pinterest"><span class="material-symbols-outlined">palette</span></a>
        </div>
        <p class="mt-8 font-label-sm text-label-sm text-secondary md:text-right">
          © ${new Date().getFullYear()} tusabysmriti. Handcrafted in Nepal.
        </p>
      </div>
    </div>
  </footer>
  `;
}

function renderApp() {
  unbindHeroCompare?.();
  unbindPortfolioCarousel?.();

  document.querySelector("#app").innerHTML = `
  ${renderHeader()}
  <main class="overflow-x-hidden">
    ${renderMainContent()}
  </main>
  ${renderFooter()}
`;

  bindEvents();
  mountClerkElements();
  renderCart();
}

async function startApp() {
  if (clerkPublishableKey) {
    try {
      await loadClerkUiBundle(clerkPublishableKey);
      clerk = new Clerk(clerkPublishableKey);
      await clerk.load({
        ui: { ClerkUI: window.__internal_ClerkUICtor },
      });
      activeUserId = clerk.user?.id ?? null;
      clerk.addListener(({ user }) => {
        const nextUserId = user?.id ?? null;
        if (nextUserId !== activeUserId) {
          activeUserId = nextUserId;
          renderApp();
        }
      });
    } catch (error) {
      authLoadError =
        error instanceof Error ? error.message : "Check your Clerk configuration.";
    }
  }

  renderApp();
}

startApp();
