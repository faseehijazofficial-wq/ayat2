(function () {
  "use strict";

  function initializeStorefront(doc) {
    initializeCarousel(doc);

    const menuToggle = doc.querySelector(".menu-toggle");
    const navigation = doc.querySelector("#primary-navigation");
    if (menuToggle && navigation) {
      function setMenuOpen(isOpen) {
        menuToggle.setAttribute("aria-expanded", String(isOpen));
        menuToggle.setAttribute("aria-label", isOpen ? "Close menu" : "Open menu");
        navigation.classList.toggle("is-open", isOpen);
      }

      menuToggle.addEventListener("click", function () {
        setMenuOpen(menuToggle.getAttribute("aria-expanded") !== "true");
      });

      navigation.querySelectorAll('a[href^="#"]').forEach(function (link) {
        link.addEventListener("click", function () {
          setMenuOpen(false);
          const target = doc.getElementById(link.getAttribute("href").slice(1));
          const focusTarget = target && target.querySelector("h1, h2");
          if (focusTarget) {
            focusTarget.setAttribute("tabindex", "-1");
            window.requestAnimationFrame(function () {
              focusTarget.focus({ preventScroll: true });
            });
          }
        });
      });

      doc.addEventListener("keydown", function (event) {
        if (event.key === "Escape" && menuToggle.getAttribute("aria-expanded") === "true") {
          setMenuOpen(false);
          menuToggle.focus();
        }
      });
    }
  }

  function initializeCarousel(doc) {
    const gallery = doc.querySelector(".hero-gallery");
    const track = doc.querySelector("[data-carousel-track]");
    if (!gallery || !track) return;

    const slides = Array.from(track.querySelectorAll(".hero-slide"));
    const dots = Array.from(gallery.querySelectorAll("[data-carousel-to]"));
    const previous = gallery.querySelector("[data-carousel-previous]");
    const next = gallery.querySelector("[data-carousel-next]");
    const pause = gallery.querySelector("[data-carousel-pause]");
    if (slides.length < 2 || dots.length !== slides.length || !previous || !next || !pause) return;

    const firstClone = slides[0].cloneNode(true);
    const lastClone = slides[slides.length - 1].cloneNode(true);
    firstClone.setAttribute("aria-hidden", "true");
    lastClone.setAttribute("aria-hidden", "true");
    track.appendChild(firstClone);
    track.insertBefore(lastClone, slides[0]);

    const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const rotationDelay = 3000;
    let activeIndex = 0;
    let timerId = 0;
    let pendingWrapReset = null;
    let manuallyPaused = Boolean(reduceMotion);
    let pointerInside = false;
    let focusInside = false;

    function stopRotation() {
      if (timerId) {
        window.clearInterval(timerId);
        timerId = 0;
      }
    }

    function showSlide(index, direction) {
      const previousIndex = activeIndex;
      activeIndex = (index + slides.length) % slides.length;
      let visualIndex = activeIndex + 1;
      let shouldResetAfterTransition = false;

      if (direction > 0 && previousIndex === slides.length - 1 && activeIndex === 0) {
        visualIndex = slides.length + 1;
        shouldResetAfterTransition = true;
      } else if (direction < 0 && previousIndex === 0 && activeIndex === slides.length - 1) {
        visualIndex = 0;
        shouldResetAfterTransition = true;
      }

      if (pendingWrapReset) {
        track.removeEventListener("transitionend", pendingWrapReset);
        pendingWrapReset = null;
      }

      track.style.transform = "translateX(-" + visualIndex * 100 + "%)";
      slides.forEach(function (slide, slideIndex) {
        slide.setAttribute("aria-hidden", String(slideIndex !== activeIndex));
      });
      dots.forEach(function (dot, dotIndex) {
        dot.setAttribute("aria-pressed", String(dotIndex === activeIndex));
      });

      if (shouldResetAfterTransition) {
        pendingWrapReset = function (event) {
          if (event.target !== track) return;
          track.removeEventListener("transitionend", pendingWrapReset);
          pendingWrapReset = null;
          track.style.transition = "none";
          track.style.transform = "translateX(-" + (activeIndex + 1) * 100 + "%)";
          window.requestAnimationFrame(function () {
            track.style.transition = "";
          });
        };
        track.addEventListener("transitionend", pendingWrapReset);
      }
    }

    function startRotation() {
      stopRotation();
      if (manuallyPaused || pointerInside || focusInside || doc.hidden) return;
      timerId = window.setInterval(function () {
        showSlide(activeIndex + 1, 1);
      }, rotationDelay);
    }

    function updatePauseButton() {
      pause.setAttribute("aria-pressed", String(manuallyPaused));
      pause.setAttribute("aria-label", manuallyPaused ? "Play automatic image rotation" : "Pause automatic image rotation");
      pause.textContent = manuallyPaused ? "Play" : "Pause";
    }

    dots.forEach(function (dot, index) {
      dot.addEventListener("click", function () {
        const forwardDistance = (index - activeIndex + slides.length) % slides.length;
        const backwardDistance = (activeIndex - index + slides.length) % slides.length;
        showSlide(index, forwardDistance <= backwardDistance ? 1 : -1);
        startRotation();
      });
    });

    previous.addEventListener("click", function () {
      showSlide(activeIndex - 1, -1);
      startRotation();
    });

    next.addEventListener("click", function () {
      showSlide(activeIndex + 1, 1);
      startRotation();
    });

    pause.addEventListener("click", function () {
      manuallyPaused = !manuallyPaused;
      updatePauseButton();
      startRotation();
    });

    gallery.addEventListener("mouseenter", function () {
      pointerInside = true;
      stopRotation();
    });

    gallery.addEventListener("mouseleave", function () {
      pointerInside = false;
      startRotation();
    });

    gallery.addEventListener("focusin", function () {
      focusInside = true;
      stopRotation();
    });

    gallery.addEventListener("focusout", function (event) {
      if (!gallery.contains(event.relatedTarget)) {
        focusInside = false;
        startRotation();
      }
    });

    doc.addEventListener("visibilitychange", function () {
      if (doc.hidden) stopRotation();
      else startRotation();
    });

    if (reduceMotion) pause.hidden = true;
    updatePauseButton();
    track.style.transition = "none";
    track.style.transform = "translateX(-100%)";
    window.requestAnimationFrame(function () {
      track.style.transition = "";
    });
    showSlide(activeIndex, 0);
    startRotation();
  }

  if (typeof document !== "undefined") initializeStorefront(document);
})();
