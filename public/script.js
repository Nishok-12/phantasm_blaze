// ============================
// GLOBAL DATE FOR MAIN EVENT COUNTDOWN
// ============================
const EVENT_DATE = new Date("October 30, 2025 00:00:00").getTime();


// ============================
// COUNTDOWN AND DATE/TIME LOGIC
// ============================

function updateDateTime() {
    const now = new Date();

    // Full Date
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: '2-digit' };
    const fullDate = now.toLocaleDateString('en-US', options);
    const dateEl = document.getElementById('current-date');
    if (dateEl) dateEl.textContent = fullDate;

    // Time
    const hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 === 0 ? 12 : hours % 12;
    const timeEl = document.getElementById('current-time');
    if (timeEl) timeEl.textContent = `${displayHours}:${minutes}:${seconds} ${ampm}`;
}

function calculateCountdown(targetDate, prefix) {
    const now = new Date().getTime();
    let diff = targetDate - now;
    if (diff < 0) diff = 0;

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    const update = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value.toString().padStart(2, '0');
    };

    update(prefix + 'days', days);
    update(prefix + 'hours', hours);
    update(prefix + 'minutes', minutes);
    update(prefix + 'seconds', seconds);
}

function eventCountdown() {
    calculateCountdown(EVENT_DATE, '');
}


// ============================
// SPARKS FALL EFFECT (Like Snowfall)
// ============================

const canvas = document.getElementById('fireCanvas');
const ctx = canvas.getContext('2d');
let particles = [];
const PARTICLE_COUNT = 200; // increase for denser sparks

class Particle {
    constructor() {
        this.reset(true);
    }

    reset(initial = false) {
        this.x = Math.random() * canvas.width;
        this.y = initial ? Math.random() * canvas.height : -10;

        this.size = Math.random() * 3 + 1; 
        this.speedY = Math.random() * 2 + 1.2; // faster fall speed
        this.speedX = Math.random() * 0.6 - 0.3; // gentle horizontal drift

        this.opacity = Math.random() * 0.8 + 0.2;

        // glowing ember colors (orange-yellow)
        const red = 255;
        const green = Math.floor(Math.random() * 120) + 80;
        const blue = Math.floor(Math.random() * 50);
        this.color = `rgba(${red}, ${green}, ${blue}, ${this.opacity})`;
    }

    update() {
        this.y += this.speedY;
        this.x += this.speedX;

        // reset when leaving screen
        if (this.y > canvas.height + 10 || this.x < -10 || this.x > canvas.width + 10) {
            this.reset();
        }
    }

    draw() {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
    }
}

function initSparks() {
    canvas.width = window.innerWidth;
    canvas.height = document.body.scrollHeight;

    particles = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
        particles.push(new Particle());
    }
}

function animateSparks() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // dynamically cover full page
    canvas.width = window.innerWidth;
    canvas.height = document.body.scrollHeight;

    for (let i = 0; i < particles.length; i++) {
        particles[i].update();
        particles[i].draw();
    }

    requestAnimationFrame(animateSparks);
}
function toggleMenu() {
    const sideMenu = document.getElementById('sideMenu');
    const hamburger = document.getElementById('hamburger');
    const closeIcon = document.getElementById('closeIcon');

    // 1. Toggle side menu visibility (CSS handles the slide-in/out via the 'open' class)
    sideMenu.classList.toggle('open');

    // 2. Control icon visibility based on the side menu state

    if (sideMenu.classList.contains('open')) {
        // Menu is OPEN
        // Hide the hamburger (it's covered by the side menu anyway, but explicit is better)
        // Note: We use style.display = 'none' here to override the default CSS 'display: flex'
        hamburger.style.display = 'none'; 
        // Show the close icon (X)
        closeIcon.style.display = 'block';

    } else {
        // Menu is CLOSED
        // Hide the close icon (X)
        closeIcon.style.display = 'none';

        // Show the hamburger icon, making sure it follows the mobile media query
        // We set it to 'flex' because your CSS defines the .hamburger container as `display: flex;`
        hamburger.style.display = 'flex'; 
    }
}
// Resize handler
window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = document.body.scrollHeight;
});

// ============================
// INIT
// ============================

initSparks();
animateSparks();

if (document.getElementById('days')) {
    setInterval(() => {
        updateDateTime();
        eventCountdown();
    }, 1000);
}

updateDateTime();
eventCountdown();


        // Function to toggle the side menu
        function toggleMenu() {
            const sideMenu = document.getElementById('sideMenu');
            const hamburger = document.getElementById('hamburger');
            const closeIcon = document.getElementById('closeIcon');
    
            // Toggle side menu visibility
            sideMenu.classList.toggle('open');
    
            // Toggle visibility of hamburger and close icon
            if (sideMenu.classList.contains('open')) {
                hamburger.style.display = 'none';
                closeIcon.style.display = 'block';
            } else {
                hamburger.style.display = 'flex';
                closeIcon.style.display = 'none';
            }
        }
    

    
        // Add ripple effect to header, footer, and side menu

        
function registerForEvent(eventId) {
    console.log("Starting event registration...");

    fetch('/api/events/register', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ eventId })
    })
    .then(async response => {
        console.log("Response received:", response.status);
        
        if (response.status === 401) {
            window.location.href = '/login.html';
        }

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || "Unknown error");
        }

        return response.json();
    })
    .then(result => {
        console.log("Registration successful:", result);
        alert('Event registered successfully!');

        // ✅ Set a flag in localStorage so profile.html can detect and update events
        localStorage.setItem("updateEvents", "true");

        // Redirect user to profile page where updateRegisteredEvents() is defined
        window.location.href = "/profile.html";
    })
    .catch(error => {
        console.error("Error occurred:", error);
        alert(error.message || "An error occurred. Please try again.");
    });
}

document.getElementById("profileLinkDesktop").addEventListener("click", checkAuth);
document.getElementById("profileLinkMobile").addEventListener("click", checkAuth);

async function checkAuth(event) {
    event.preventDefault();
    
    try {
        const response = await fetch("/api/user/check-auth", {
            method: "GET",
            credentials: "include"
        });

        if (response.ok) {
            window.location.href = "/profile.html";
        } else {
            alert("Login first!");
            window.location.href = "/login.html";
        }
    } catch (error) {
        console.error("Error checking authentication:", error);
        alert("Login first!");
        window.location.href = "/login.html";
    }
}



document.querySelector('.logo').addEventListener('click', function() {
    window.location.href = 'index.html';
  });


