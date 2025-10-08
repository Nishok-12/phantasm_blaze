// Slide the event cards
function slide(id, direction) {
    const slider = document.getElementById(id);
    const scrollAmount = 400;
    slider.scrollBy({ left: direction * scrollAmount, behavior: 'smooth' });
}

// Redirect to event page
function redirectTo(page) {
    window.location.href = page;
}

// -------------------- Generic Slider Function --------------------
function initSlider(sliderSelector, leftBtnSelector, rightBtnSelector, dotSelector, auto = false, interval = 1000) {
    const slides = document.querySelectorAll(`${sliderSelector} .slide, ${sliderSelector} .slide-main`);
    const dots = dotSelector ? document.querySelectorAll(dotSelector) : null;
    const leftBtn = document.querySelector(leftBtnSelector);
    const rightBtn = document.querySelector(rightBtnSelector);
    let index = 0;
    let autoSlide;

    function showSlide(i) {
        if (i >= slides.length) i = 0;
        if (i < 0) i = slides.length - 1;

        slides.forEach((slide) => slide.classList.remove("active-slide"));
        slides[i].classList.add("active-slide");

        if (dots) {
            dots.forEach((dot) => dot.classList.remove("active-dot"));
            dots[i].classList.add("active-dot");
        }

        index = i;
    }

    function next() { showSlide(index + 1); }
    function prev() { showSlide(index - 1); }

    if (leftBtn) leftBtn.addEventListener("click", prev);
    if (rightBtn) rightBtn.addEventListener("click", next);
    if (dots) dots.forEach((dot, i) => dot.addEventListener("click", () => showSlide(i)));

    if (auto) {
        autoSlide = setInterval(next, interval);
        const sliderElement = document.querySelector(sliderSelector);
        sliderElement.addEventListener("mouseover", () => clearInterval(autoSlide));
        sliderElement.addEventListener("mouseout", () => autoSlide = setInterval(next, interval));
    }

    showSlide(index);
}

// -------------------- Initialize Main Event Slider --------------------
initSlider(".main-event-slider", ".left-arrow-main", ".right-arrow-main", ".dot-main", true, 1000);

// -------------------- Initialize Technical Slider --------------------
function slide(id, direction) {
    const slider = document.getElementById(id);
    const scrollAmount = 400;
    slider.scrollBy({ left: direction * scrollAmount, behavior: 'smooth' });
}

// -------------------- Redirect Function --------------------
function redirectTo(page) {
    window.location.href = page;
}

