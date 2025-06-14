document.addEventListener('DOMContentLoaded', function() {
  AOS.init({
    duration: 800,
    once: false,
    offset: 80,
    delay: 100,
    disable: false
  });

    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      e.preventDefault();
      const targetId = this.getAttribute('href');
      const targetElement = document.querySelector(targetId);
      
      if (targetElement) {
        window.scrollTo({
          top: targetElement.offsetTop,
          behavior: 'smooth'
        });
      }
    });
  });
  
  document.addEventListener('DOMContentLoaded', function() {
    const howItWorksSection = document.getElementById('how-it-works');
    const steps = document.querySelectorAll('.how-it-works .step');
    const pricing = document.getElementById('pricing');
    const featuresSection = document.getElementById('features');
    const scrollIndicator = document.querySelector('.scroll-indicator');
    
    steps.forEach((step, index) => {
      step.classList.add('step-hidden');
      step.dataset.stepIndex = index;
      step.removeAttribute('data-aos');
      step.removeAttribute('data-aos-delay');
    });
    
    const stepObservers = [];
    
    steps.forEach((step, index) => {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting && index === visibleSteps) {
            showNextStep();
          }
        });
      }, { threshold: 0.6, rootMargin: '-100px 0px' });
      
      observer.observe(step);
      stepObservers.push(observer);
    });
    
    const sectionObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && visibleSteps === 0) {
          showNextStep();
        }
      });
    }, { threshold: 0.3 });
    
    const completionObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && visibleSteps === totalSteps) {
          isHowItWorksLocked = false;
        }
      });
    }, { threshold: 0.7 });
    
    sectionObserver.observe(howItWorksSection);
    completionObserver.observe(pricing);
  });
  
  var typed = new Typed('.typewriter', {
    strings: [
      "무엇을 할 수 있나요?",
      "고객응대를 자동화하세요",
      "24시간 응답하세요", 
      "비용을 절감하세요",
      "업무 효율을 높이세요"
    ],
    typeSpeed: 70,
    backSpeed: 50,
    startDelay: 300,
    loop: true,
    showCursor: true,
    cursorChar: '|',
    smartBackspace: true
  });
  
  window.addEventListener('scroll', function() {
    const scrollPosition = window.scrollY;
    const navLinks = document.querySelectorAll('.scroll-nav a');
    const sections = document.querySelectorAll('section');
    
    sections.forEach((section, index) => {
      const sectionTop = section.offsetTop - 100;
      const sectionHeight = section.offsetHeight;
      
      if(scrollPosition >= sectionTop && scrollPosition < sectionTop + sectionHeight) {
        navLinks.forEach(link => link.classList.remove('active'));
        if (navLinks[index]) {
          navLinks[index].classList.add('active');
        }
      }
    });
    
    const navbar = document.querySelector('.navbar');
    if(scrollPosition > 50) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
    
    const heroVisual = document.querySelector('.hero-visual');
    if (heroVisual) {
      heroVisual.style.transform = `translateY(${scrollPosition * 0.2}px)`;
    }
    
    const animatedElements = document.querySelectorAll('.scroll-animate');
    animatedElements.forEach(element => {
      const elementTop = element.getBoundingClientRect().top;
      const windowHeight = window.innerHeight;
      
      if (elementTop < windowHeight * 0.8) {
        element.classList.add('visible');
      } else {
        element.classList.remove('visible');
      }
    });
  });
  
  const howItWorksSection = document.getElementById('how-it-works');
  if (howItWorksSection) {
    let sectionLockedAndAnimating = false; 

    const sectionObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.70 && !sectionLockedAndAnimating) {
          sectionLockedAndAnimating = true;
          document.body.style.overflow = 'hidden';

          const maxAosDelay = Math.max(...Array.from(howItWorksSection.querySelectorAll('.step[data-aos-delay]')).map(el => parseInt(el.dataset.aosDelay) || 0));
          const aosDuration = 800;
          const unlockDelay = maxAosDelay + aosDuration + 400;

          setTimeout(() => {
            document.body.style.overflow = ''; 
            }, unlockDelay);

        } else if (!entry.isIntersecting && sectionLockedAndAnimating) {
          document.body.style.overflow = '';
          sectionLockedAndAnimating = false;
        }
      });
    }, { threshold: [0, 0.25, 0.5, 0.70, 0.75, 1.0] }); 

    sectionObserver.observe(howItWorksSection);
  }

  const mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
  if (mobileMenuToggle) {
    mobileMenuToggle.addEventListener('click', function() {
      const navMenu = document.querySelector('.nav-menu');
      mobileMenuToggle.classList.toggle('active');
      navMenu.classList.toggle('active');
    });
  }
  
  const scrollToTopBtn = document.getElementById('scrollToTop');
  if (scrollToTopBtn) {
    scrollToTopBtn.addEventListener('click', function(e) {
      e.preventDefault();
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    });
  }
  
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      if (this.getAttribute('href') !== '#') {
        e.preventDefault();
        const targetId = this.getAttribute('href');
        const targetElement = document.querySelector(targetId);
        if (targetElement) {
          window.scrollTo({
            top: targetElement.offsetTop - 80, 
            behavior: 'smooth'
          });
          
          const navMenu = document.querySelector('.nav-menu');
          if (navMenu.classList.contains('active')) {
            navMenu.classList.remove('active');
            mobileMenuToggle.classList.remove('active');
          }
        }
      }
    });
  });
});
