
// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyD8HjXwynugy5q-_KlqLajw27PDgUJ4QUk",
    authDomain: "bubuwi-pro.firebaseapp.com",
    projectId: "bubuwi-pro",
    storageBucket: "bubuwi-pro.firebasestorage.app",
    messagingSenderId: "741891119074",
    appId: "1:741891119074:web:93cc65fb2cd94033aa4bbb"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Global variables
let currentRoute = '/';
let animeData = [];
let searchResults = [];
let currentCarouselIndex = 0;
let carouselInterval;

// API Base URL
const API_BASE = '/.netlify/functions/scrape';

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    initializeHeroAnimations();
    initializeNavigation();
    initializeRouter();
    handleRoute(window.location.pathname);
});

// Hero Section Animations
function initializeHeroAnimations() {
    gsap.registerPlugin(ScrollTrigger);
    
    // Animate logo and title
    gsap.timeline()
        .to('.logo-container', {
            opacity: 1,
            y: 0,
            duration: 1,
            ease: "power3.out",
            delay: 0.5
        })
        .to('.spline-3d', {
            opacity: 1,
            scale: 1,
            duration: 1.2,
            ease: "power3.out"
        }, "-=0.5")
        .to('.scroll-indicator', {
            opacity: 1,
            duration: 0.8,
            ease: "power2.out"
        }, "-=0.3");

    // Hero scroll trigger
    ScrollTrigger.create({
        trigger: ".hero-section",
        start: "top top",
        end: "bottom top",
        scrub: 1,
        onUpdate: self => {
            const progress = self.progress;
            gsap.to('.hero-content', {
                y: progress * 100,
                opacity: 1 - progress,
                duration: 0.3
            });
        }
    });

    // Parallax background
    gsap.to('.hero-background', {
        yPercent: -50,
        ease: "none",
        scrollTrigger: {
            trigger: ".hero-section",
            start: "top bottom",
            end: "bottom top",
            scrub: true
        }
    });
}

// Navigation System
function initializeNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            const route = item.getAttribute('data-route');
            MapsTo(route);
        });
    });
    
    // Handle browser back/forward
    window.addEventListener('popstate', (e) => {
        handleRoute(window.location.pathname);
    });
}

// Router Functions
function MapsTo(route) {
    if (route !== currentRoute) {
        currentRoute = route;
        history.pushState(null, '', route);
        handleRoute(route);
        updateActiveNav();
    }
}

function updateActiveNav() {
    const navItems = document.querySelectorAll('.nav-item');
    const currentPath = window.location.pathname;
    
    navItems.forEach(item => {
        const route = item.getAttribute('data-route');
        if (route === currentPath || (currentPath === '/' && route === '/')) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
}

// Route Handler
async function handleRoute(route) {
    showLoading();
    const appContent = document.getElementById('app-content');
    
    try {
        if (route === '/' || route === '') {
            await renderHomePage();
        } else if (route === '/subscribe') {
            await renderSubscribePage();
        } else if (route === '/akun') {
            renderAccountPage();
        } else if (route.startsWith('/detail/')) {
            const slug = route.split('/detail/')[1];
            await renderDetailPage(slug);
        } else if (route.startsWith('/nonton/')) {
            const parts = route.split('/');
            const slug = parts[2];
            const episodeNum = parts[4];
            await renderWatchPage(slug, episodeNum);
        } else {
            renderNotFoundPage();
        }
    } catch (error) {
        console.error('Route handling error:', error);
        renderErrorPage();
    }
    
    hideLoading();
    updateActiveNav();
    animatePageElements();
}

// API Functions
async function fetchAPI(params = {}) {
    const url = new URL(API_BASE, window.location.origin);
    Object.keys(params).forEach(key => {
        if (params[key]) url.searchParams.append(key, params[key]);
    });
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (!data.success) {
        throw new Error(data.error || 'API request failed');
    }
    
    return data.data;
}

// Page Renderers
async function renderHomePage() {
    const appContent = document.getElementById('app-content');
    
    try {
        animeData = await fetchAPI();
        
        appContent.innerHTML = `
            <div class="top-releases fade-in">
                <h2 class="section-title">Rilisan Teratas</h2>
                <div class="carousel-container">
                    <div class="carousel" id="top-carousel">
                        ${animeData.slice(0, 3).map(anime => `
                            <div class="carousel-item" data-slug="${anime.slug}" data-title="${anime.title}" data-thumbnail="${anime.thumbnail}">
                                <img src="${anime.thumbnail}" alt="${anime.title}" loading="lazy">
                                <div class="carousel-item-content">
                                    <div class="carousel-item-title">${anime.title}</div>
                                    <div class="carousel-item-episode">${anime.episode}</div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
            
            <div class="search-section fade-in">
                <h2 class="section-title">Cari Anime</h2>
                <div class="search-container">
                    <input type="text" class="search-input" placeholder="Masukkan nama anime..." id="search-input">
                </div>
            </div>
            
            <div class="anime-grid-section fade-in">
                <h2 class="section-title">Anime Terbaru</h2>
                <div class="anime-grid" id="anime-grid">
                    ${animeData.slice(3).map(anime => `
                        <div class="anime-card" data-slug="${anime.slug}" data-title="${anime.title}" data-thumbnail="${anime.thumbnail}">
                            <img src="${anime.thumbnail}" alt="${anime.title}" loading="lazy">
                            <div class="anime-card-content">
                                <div class="anime-card-title">${anime.title}</div>
                                <div class="anime-card-episode">${anime.episode}</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        
        initializeCarousel();
        initializeSearch();
        attachAnimeCardListeners();
        
    } catch (error) {
        console.error('Error rendering home page:', error);
        appContent.innerHTML = '<div class="error-message">Gagal memuat data anime. Silakan coba lagi.</div>';
    }
}

async function renderDetailPage(slug) {
    const appContent = document.getElementById('app-content');
    
    try {
        // Find anime from current data or fetch from API
        let anime = animeData.find(a => a.slug === slug);
        if (!anime) {
            // Try to construct URL from slug
            const animeUrl = `https://samehadaku.li/anime/${slug}/`;
            anime = await fetchAPI({ animePage: animeUrl });
        } else {
            // Fetch detailed info
            const animeUrl = anime.link || `https://samehadaku.li/anime/${slug}/`;
            anime = await fetchAPI({ animePage: animeUrl });
        }
        
        if (!anime) {
            renderNotFoundPage();
            return;
        }
        
        const isSubscribed = checkSubscription(slug);
        
        appContent.innerHTML = `
            <div class="detail-container fade-in">
                <div class="detail-header">
                    <div class="detail-poster">
                        <img src="${anime.thumbnail}" alt="${anime.title}" loading="lazy">
                    </div>
                    <div class="detail-info">
                        <h1 class="detail-title">${anime.title}</h1>
                        <div class="detail-episodes-count">Total Episodes: ${anime.totalEpisodes || anime.episodes?.length || 'Unknown'}</div>
                        <button class="subscribe-btn ${isSubscribed ? 'subscribed' : ''}" id="subscribe-btn" data-slug="${slug}" data-title="${anime.title}" data-thumbnail="${anime.thumbnail}">
                            ${isSubscribed ? 'Unsubscribe' : 'Subscribe'}
                        </button>
                    </div>
                </div>
                
                <div class="episodes-section">
                    <h2 class="section-title">List Episode</h2>
                    <div class="episodes-grid">
                        ${anime.episodes?.map(episode => `
                            <div class="episode-item" data-slug="${slug}" data-episode="${episode.number}" data-episode-url="${episode.link}">
                                <div class="episode-number">${episode.number}</div>
                                <div class="episode-title">${episode.title || `Episode ${episode.number}`}</div>
                            </div>
                        `).join('') || '<p>Episodes not available</p>'}
                    </div>
                </div>
            </div>
        `;
        
        initializeSubscribeButton();
        attachEpisodeListeners();
        
    } catch (error) {
        console.error('Error rendering detail page:', error);
        appContent.innerHTML = '<div class="error-message">Gagal memuat detail anime. Silakan coba lagi.</div>';
    }
}

async function renderWatchPage(slug, episodeNum) {
    const appContent = document.getElementById('app-content');
    
    try {
        // Get anime details
        const animeUrl = `https://samehadaku.li/anime/${slug}/`;
        const anime = await fetchAPI({ animePage: animeUrl });
        
        if (!anime || !anime.episodes) {
            renderNotFoundPage();
            return;
        }
        
        const currentEpisode = anime.episodes.find(ep => ep.number == episodeNum);
        if (!currentEpisode) {
            renderNotFoundPage();
            return;
        }
        
        // Get video URL
        const episodeData = await fetchAPI({ url: currentEpisode.link });
        
        const currentIndex = anime.episodes.findIndex(ep => ep.number == episodeNum);
        const prevEpisode = anime.episodes[currentIndex - 1];
        const nextEpisode = anime.episodes[currentIndex + 1];
        
        appContent.innerHTML = `
            <div class="watch-container fade-in">
                <div class="watch-header">
                    <button class="back-btn" onclick="MapsTo('/detail/${slug}')">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
                            <path d="M19 12H5M12 19l-7-7 7-7"/>
                        </svg>
                    </button>
                    <div class="watch-title">${anime.title}</div>
                </div>
                
                <div class="episode-info">
                    <h2>Episode ${episodeNum}</h2>
                </div>
                
                <div class="video-container">
                    <iframe class="video-iframe" src="${episodeData?.videoUrl || ''}" allowfullscreen></iframe>
                </div>
                
                <div class="episode-controls">
                    <button class="control-btn" ${!prevEpisode ? 'disabled' : ''} onclick="MapsTo('/nonton/${slug}/episode/${prevEpisode?.number}')">
                        ← Previous
                    </button>
                    <button class="control-btn" ${!nextEpisode ? 'disabled' : ''} onclick="MapsTo('/nonton/${slug}/episode/${nextEpisode?.number}')">
                        Next →
                    </button>
                </div>
                
                <div class="episodes-section">
                    <h3 class="section-title">List Episode</h3>
                    <div class="episode-list">
                        ${anime.episodes.map(episode => `
                            <div class="episode-box ${episode.number == episodeNum ? 'current' : ''}" onclick="MapsTo('/nonton/${slug}/episode/${episode.number}')">
                                ${episode.number}
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
        
    } catch (error) {
        console.error('Error rendering watch page:', error);
        appContent.innerHTML = '<div class="error-message">Gagal memuat episode. Silakan coba lagi.</div>';
    }
}

async function renderSubscribePage() {
    const appContent = document.getElementById('app-content');
    const subscriptions = getSubscriptions();
    
    if (subscriptions.length === 0) {
        appContent.innerHTML = `
            <div class="fade-in" style="text-align: center; padding: 2rem;">
                <h2 class="section-title">Subscriptions</h2>
                <p style="color: var(--text-secondary); margin-top: 1rem;">Belum ada anime yang di-subscribe.</p>
                <button class="subscribe-btn" onclick="MapsTo('/')" style="margin-top: 1rem;">
                    Jelajahi Anime
                </button>
            </div>
        `;
        return;
    }
    
    appContent.innerHTML = `
        <div class="fade-in">
            <h2 class="section-title">Subscriptions</h2>
            <div class="subscriptions-grid">
                ${subscriptions.map(anime => `
                    <div class="subscription-card" data-slug="${anime.slug}" data-title="${anime.title}" data-thumbnail="${anime.thumbnail}">
                        <img src="${anime.thumbnail}" alt="${anime.title}" loading="lazy">
                        <div class="anime-card-content">
                            <div class="anime-card-title">${anime.title}</div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
    
    attachAnimeCardListeners();
}

function renderAccountPage() {
    const appContent = document.getElementById('app-content');
    
    appContent.innerHTML = `
        <div class="account-container fade-in">
            <h2 class="section-title">Developer Account</h2>
            
            <div class="developer-info">
                <h3>About Developer</h3>
                <p style="margin: 1rem 0; color: var(--text-secondary);">
                    Bubuwi-V3 dikembangkan dengan teknologi modern untuk memberikan pengalaman streaming anime terbaik.
                </p>
                
                <div class="social-links">
                    <a href="https://www.instagram.com/adnanmwa" target="_blank" class="social-link">
                        <img src="https://upload.wikimedia.org/wikipedia/commons/a/a5/Instagram_icon.png" alt="Instagram">
                        @adnanmwa
                    </a>
                    <a href="https://www.tiktok.com/@adnansagiri" target="_blank" class="social-link">
                        <img src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQNxuydAoOVzXmO6EXy6vZhaJ17jCGvYKITEzu7BNMYkEaux6HqKvnQax0Q&s=10" alt="TikTok">
                        @adnansagiri
                    </a>
                </div>
            </div>
        </div>
    `;
}

function renderNotFoundPage() {
    const appContent = document.getElementById('app-content');
    appContent.innerHTML = `
        <div class="fade-in" style="text-align: center; padding: 2rem;">
            <h2 class="section-title">404 - Not Found</h2>
            <p style="color: var(--text-secondary); margin: 1rem 0;">Halaman yang Anda cari tidak ditemukan.</p>
            <button class="subscribe-btn" onclick="MapsTo('/')">Kembali ke Beranda</button>
        </div>
    `;
}

function renderErrorPage() {
    const appContent = document.getElementById('app-content');
    appContent.innerHTML = `
        <div class="fade-in" style="text-align: center; padding: 2rem;">
            <h2 class="section-title">Error</h2>
            <p style="color: var(--text-secondary); margin: 1rem 0;">Terjadi kesalahan. Silakan coba lagi.</p>
            <button class="subscribe-btn" onclick="location.reload()">Refresh</button>
        </div>
    `;
}

// Feature Functions
function initializeCarousel() {
    const carousel = document.getElementById('top-carousel');
    if (!carousel) return;
    
    // Auto-scroll every 5 seconds
    carouselInterval = setInterval(() => {
        currentCarouselIndex = (currentCarouselIndex + 1) % 3;
        const translateX = -currentCarouselIndex * 320; // 300px width + 20px gap
        carousel.style.transform = `translateX(${translateX}px)`;
    }, 5000);
    
    // Add touch/mouse scroll support
    let startX = 0;
    let currentX = 0;
    let isDragging = false;
    
    carousel.addEventListener('mousedown', startDrag);
    carousel.addEventListener('touchstart', startDrag);
    carousel.addEventListener('mousemove', drag);
    carousel.addEventListener('touchmove', drag);
    carousel.addEventListener('mouseup', endDrag);
    carousel.addEventListener('touchend', endDrag);
    carousel.addEventListener('mouseleave', endDrag);
    
    function startDrag(e) {
        isDragging = true;
        startX = e.type === 'mousedown' ? e.clientX : e.touches[0].clientX;
        clearInterval(carouselInterval);
    }
    
    function drag(e) {
        if (!isDragging) return;
        e.preventDefault();
        currentX = (e.type === 'mousemove' ? e.clientX : e.touches[0].clientX) - startX;
    }
    
    function endDrag() {
        if (!isDragging) return;
        isDragging = false;
        
        if (Math.abs(currentX) > 50) {
            if (currentX > 0 && currentCarouselIndex > 0) {
                currentCarouselIndex--;
            } else if (currentX < 0 && currentCarouselIndex < 2) {
                currentCarouselIndex++;
            }
        }
        
        const translateX = -currentCarouselIndex * 320;
        carousel.style.transform = `translateX(${translateX}px)`;
        currentX = 0;
        
        // Restart auto-scroll
        carouselInterval = setInterval(() => {
            currentCarouselIndex = (currentCarouselIndex + 1) % 3;
            const translateX = -currentCarouselIndex * 320;
            carousel.style.transform = `translateX(${translateX}px)`;
        }, 5000);
    }
}

function initializeSearch() {
    const searchInput = document.getElementById('search-input');
    if (!searchInput) return;
    
    let searchTimeout;
    
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        const query = e.target.value.trim();
        
        if (query.length === 0) {
            renderSearchResults([]);
            return;
        }
        
        if (query.length < 2) return;
        
        searchTimeout = setTimeout(async () => {
            try {
                showLoading();
                const results = await fetchAPI({ search: query });
                renderSearchResults(results);
            } catch (error) {
                console.error('Search error:', error);
                renderSearchResults([]);
            } finally {
                hideLoading();
            }
        }, 500);
    });
}

function renderSearchResults(results) {
    const animeGrid = document.getElementById('anime-grid');
    if (!animeGrid) return;
    
    if (results.length === 0) {
        animeGrid.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">Tidak ada hasil ditemukan.</p>';
        return;
    }
    
    animeGrid.innerHTML = results.map(anime => `
        <div class="anime-card" data-slug="${anime.slug}" data-title="${anime.title}" data-thumbnail="">
            <img src="https://via.placeholder.com/250x300?text=No+Image" alt="${anime.title}" loading="lazy">
            <div class="anime-card-content">
                <div class="anime-card-title">${anime.title}</div>
            </div>
        </div>
    `).join('');
    
    attachAnimeCardListeners();
}

// Event Listeners
function handleNavigateToDetail(event) {
    const card = event.currentTarget;
    const slug = card.getAttribute('data-slug');
    
    if (slug) {
        MapsTo(`/detail/${slug}`);
    }
}

function attachAnimeCardListeners() {
    const cards = document.querySelectorAll('.anime-card, .carousel-item, .subscription-card');
    cards.forEach(card => {
        card.addEventListener('click', handleNavigateToDetail);
    });
}

function attachEpisodeListeners() {
    const episodes = document.querySelectorAll('.episode-item');
    episodes.forEach(episode => {
        episode.addEventListener('click', (e) => {
            const slug = episode.getAttribute('data-slug');
            const episodeNum = episode.getAttribute('data-episode');
            MapsTo(`/nonton/${slug}/episode/${episodeNum}`);
        });
    });
}

function initializeSubscribeButton() {
    const subscribeBtn = document.getElementById('subscribe-btn');
    if (!subscribeBtn) return;
    
    subscribeBtn.addEventListener('click', (e) => {
        const slug = subscribeBtn.getAttribute('data-slug');
        const title = subscribeBtn.getAttribute('data-title');
        const thumbnail = subscribeBtn.getAttribute('data-thumbnail');
        
        toggleSubscription(slug, title, thumbnail);
        
        const isSubscribed = checkSubscription(slug);
        subscribeBtn.textContent = isSubscribed ? 'Unsubscribe' : 'Subscribe';
        subscribeBtn.classList.toggle('subscribed', isSubscribed);
    });
}

// Subscription Management
function getSubscriptions() {
    const stored = localStorage.getItem('bubuwi_subscriptions');
    return stored ? JSON.parse(stored) : [];
}

function saveSubscriptions(subscriptions) {
    localStorage.setItem('bubuwi_subscriptions', JSON.stringify(subscriptions));
}

function checkSubscription(slug) {
    const subscriptions = getSubscriptions();
    return subscriptions.some(sub => sub.slug === slug);
}

function toggleSubscription(slug, title, thumbnail) {
    const subscriptions = getSubscriptions();
    const existingIndex = subscriptions.findIndex(sub => sub.slug === slug);
    
    if (existingIndex > -1) {
        subscriptions.splice(existingIndex, 1);
    } else {
        subscriptions.push({ slug, title, thumbnail });
    }
    
    saveSubscriptions(subscriptions);
}

// Utility Functions
function showLoading() {
    const overlay = document.getElementById('loading-overlay');
    overlay.classList.add('show');
}

function hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    overlay.classList.remove('show');
}

function animatePageElements() {
    const elements = document.querySelectorAll('.fade-in, .slide-up');
    
    elements.forEach((element, index) => {
        gsap.fromTo(element, 
            { 
                opacity: 0, 
                y: 30 
            }, 
            { 
                opacity: 1, 
                y: 0, 
                duration: 0.6, 
                delay: index * 0.1,
                ease: "power3.out"
            }
        );
    });
}

function initializeRouter() {
    // Initialize router with current path
    const path = window.location.pathname;
    currentRoute = path;
    updateActiveNav();
}

// Service worker registration (optional for PWA)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => console.log('SW registered:', registration))
            .catch(registrationError => console.log('SW registration failed:', registrationError));
    });
}
