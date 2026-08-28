const modal = document.getElementById('popupModal');
const agreeButton = document.querySelector('.btn-close');
const menuAudio = document.getElementById('Menu');
const clickAudio = document.getElementById('clickSound');

const menuView = document.getElementById('menu-view');
const g8mesView = document.getElementById('g8mes-view');
const creditsView = document.getElementById('credits-view');
const pr8xiesView = document.getElementById('pr8xies-view');
const optionsView = document.getElementById('options-view');

const toG8mesBtn = document.getElementById('to-g8mes-btn');
const toMenuBtn = document.getElementById('to-menu-btn');
const toCreditsBtn = document.getElementById('to-credits-btn');
const backFromCreditsBtn = document.getElementById('to-menu-from-credits');
const toPr8xiesBtn = document.getElementById('to-pr8xies-btn');
const backFromPr8xiesBtn = document.getElementById('to-menu-from-pr8xies');
const toOptionsBtn = document.getElementById('to-options-btn');
const backFromOptionsBtn = document.getElementById('to-menu-from-options');

const splashElements = document.querySelectorAll('.splash-text');
const splashes = [
    "Un🅱️locked & Loaded!",
    "Now with pr#xies!",
    "May contain bugs!",
    "Be a bad sport!",
    "Love everyone!",
    "Love is love!",
    "Stay silly!",
    "Powered by questionable code!",
    "May contain pixels!",
    "Be yourself!",
    "Probably works!",
    "Running on vibes!",
    "Different is cool!",
    "404: Productivity not found!",
    "Questionably educational!",
    "Labels are optional!",
    "Too cool for school!",
    "Powered by pure chaos!",
    "Everyone belongs!",
    "Nothing suspicious here!",
    "Keep it lowkey!",
    "Certified time waster!",
    "Do what makes you happy!",
    "Probably not blocked!",
    "Loading questionable decisions!"
];

if (splashElements.length > 0) {
    const randomIndex = Math.floor(Math.random() * splashes.length);
    const chosenSplash = splashes[randomIndex];
    splashElements.forEach(element => element.textContent = chosenSplash);
}

window.addEventListener('DOMContentLoaded', () => {
    if (modal) {
        modal.showModal();
    }

    const backgrounds = [
        "images/background.png",
        "images/background2.png",
        "images/background3.png",
        "images/background4.png"
    ];

    const randomBgIndex = Math.floor(Math.random() * backgrounds.length);
    const chosenBackground = backgrounds[randomBgIndex];
    document.body.style.backgroundImage = `url('${chosenBackground}')`;

    const savedTitle = localStorage.getItem('customTabTitle');
    const savedIcon = localStorage.getItem('customTabIcon');

    if (savedTitle) {
        document.title = savedTitle;
        if (titleInput) titleInput.value = savedTitle;
    }
    
    if (savedIcon && faviconElement) {
        faviconElement.setAttribute('type', 'image/png');
        faviconElement.setAttribute('href', savedIcon);
        if (iconSelect) iconSelect.value = savedIcon;
    }

    renderUserSavedLinks();
    
    const savedMuteSetting = localStorage.getItem('siteMuted') === 'true';
    applyMuteState(savedMuteSetting);

});

if (agreeButton && menuAudio) {
    agreeButton.addEventListener('click', () => {
        menuAudio.play().catch(err => console.log("Music failed:", err));
    });
}

function navigateTo(currentView, targetView) {
    if (clickAudio) {
        clickAudio.currentTime = 0;
        clickAudio.play().catch(err => console.log("Sound failed:", err));
    }
    currentView.classList.add('hidden');
    targetView.classList.remove('hidden');
}

if (toG8mesBtn) {
    toG8mesBtn.addEventListener('click', (e) => { e.preventDefault(); navigateTo(menuView, g8mesView); });
}

if (toMenuBtn) {
    toMenuBtn.addEventListener('click', (e) => { e.preventDefault(); navigateTo(g8mesView, menuView); });
}

if (toCreditsBtn) {
    toCreditsBtn.addEventListener('click', (e) => { e.preventDefault(); navigateTo(menuView, creditsView); });
}

if (backFromCreditsBtn) {
    backFromCreditsBtn.addEventListener('click', (e) => { e.preventDefault(); navigateTo(creditsView, menuView); });
}

if (toPr8xiesBtn) {
    toPr8xiesBtn.addEventListener('click', (e) => { e.preventDefault(); navigateTo(menuView, pr8xiesView); });
}

if (backFromPr8xiesBtn) {
    backFromPr8xiesBtn.addEventListener('click', (e) => { e.preventDefault(); navigateTo(pr8xiesView, menuView); });
}

if (toOptionsBtn) {
    toOptionsBtn.addEventListener('click', (e) => { e.preventDefault(); navigateTo(menuView, optionsView); });
}

if (backFromOptionsBtn) {
    backFromOptionsBtn.addEventListener('click', (e) => { e.preventDefault(); navigateTo(optionsView, menuView); });
}

const proxyInput = document.getElementById('proxy-link-input');
const launchBtn = document.getElementById('launch-portal-btn');
const portalFrame = document.getElementById('portal-frame');

if (launchBtn && proxyInput && portalFrame) {
    launchBtn.addEventListener('click', () => {
        let cleanUrl = proxyInput.value.trim();
        if (!cleanUrl) return;

        if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
            cleanUrl = 'https://' + cleanUrl;
        }

        portalFrame.src = cleanUrl;
    });
}

const titleInput = document.getElementById('tab-title-input');
const iconSelect = document.getElementById('tab-icon-select');
const saveOptionsBtn = document.getElementById('save-options-btn');
const faviconElement = document.getElementById('favicon-link'); 

if (saveOptionsBtn && titleInput && iconSelect) {
    saveOptionsBtn.addEventListener('click', () => {
        if (clickAudio) {
            clickAudio.currentTime = 0;
            clickAudio.play().catch(err => console.log(err));
        }

        const userTitle = titleInput.value.trim();
        const userIcon = iconSelect.value;

        if (userTitle) {
            document.title = userTitle;
            localStorage.setItem('customTabTitle', userTitle);
        } else {
            document.title = "New Tab";
            localStorage.removeItem('customTabTitle');
        }

        if (faviconElement) {
            if (userIcon && userIcon !== 'about:blank') {
                localStorage.setItem('customTabIcon', userIcon);
                faviconElement.setAttribute('type', 'image/png');
                faviconElement.setAttribute('href', userIcon);
            } else if (userIcon === 'about:blank') {
                localStorage.setItem('customTabIcon', 'about:blank');
                faviconElement.removeAttribute('type');
                faviconElement.setAttribute('href', 'about:blank');
            } else {
                localStorage.removeItem('customTabIcon');
                faviconElement.setAttribute('type', 'image/x-icon');
                faviconElement.setAttribute('href', 'favicon.ico'); 
            }
        }

        alert("Disguise applied successfully!");
    });
}

const aboutBlankBtn = document.getElementById('about-blank-btn');

if (aboutBlankBtn) {
    aboutBlankBtn.addEventListener('click', () => {
        const blankWindow = window.open('about:blank', '_blank');

        if (blankWindow) {
            blankWindow.document.open();
            blankWindow.document.write(document.documentElement.outerHTML);
            blankWindow.document.close();
        }
    });
}

const muteBtn = document.getElementById('mute-btn');
const muteIcon = document.getElementById('mute-icon');
const muteText = document.getElementById('mute-text');
const allAudioElements = document.querySelectorAll('audio');

function applyMuteState(isMuted) {
    allAudioElements.forEach(audio => {
        audio.muted = isMuted;
    });

    if (isMuted) {
        if (muteIcon) muteIcon.textContent = "🔇";
        if (muteText) muteText.textContent = "Unmute";
    } else {
        if (muteIcon) muteIcon.textContent = "🔊";
        if (muteText) muteText.textContent = "Mute";
    }
}

if (muteBtn) {
    muteBtn.addEventListener('click', () => {
        if (clickAudio) {
            clickAudio.currentTime = 0;
            clickAudio.play().catch(err => console.log(err));
        }

        const nextMuteState = menuAudio ? !menuAudio.muted : true;
        applyMuteState(nextMuteState);
        localStorage.setItem('siteMuted', nextMuteState);
    });
}

const permanentLinks = [
    { name: "Test 1", url: "https://google.com" },
    { name: "Test 2", url: "https://bing.com" },
    { name: "Test 3", url: "https://duckduckgo.com" },
    { name: "Test 4", url: "https://wikipedia.org" }
];

const builtInGrid = document.getElementById('built-in-links-grid');
const userGrid = document.getElementById('user-links-grid');
const customNameInput = document.getElementById('custom-link-name');
const customUrlInput = document.getElementById('custom-link-url');
const saveLinkBtn = document.getElementById('save-custom-link-btn');

function removeCustomLink(index) {
    if (clickAudio) {
        clickAudio.currentTime = 0;
        clickAudio.play().catch(err => console.log(err));
    }
    const saved = JSON.parse(localStorage.getItem('userSavedLinks') || '[]');
    saved.splice(index, 1);
    localStorage.setItem('userSavedLinks', JSON.stringify(saved));
    renderUserSavedLinks();
}

function renderUserSavedLinks() {
    if (!userGrid) return;
    userGrid.innerHTML = '';
    const saved = JSON.parse(localStorage.getItem('userSavedLinks') || '[]');
    
    saved.forEach((item, index) => {
        const slotWrapper = document.createElement('div');
        slotWrapper.style.position = 'relative';
        slotWrapper.style.display = 'inline-block';
        slotWrapper.style.width = '100%';

        const linkAnchor = document.createElement('a');
        linkAnchor.href = '#';
        linkAnchor.className = 'custom-button';
        linkAnchor.textContent = item.name;
        linkAnchor.style.width = '100%';
        linkAnchor.style.boxSizing = 'border-box';

        linkAnchor.addEventListener('click', (e) => {
            e.preventDefault();
            if (clickAudio) {
                clickAudio.currentTime = 0;
                clickAudio.play().catch(err => console.log(err));
            }
            window.open(item.url, '_blank');
        });

        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'X';
        deleteBtn.style.position = 'absolute';
        deleteBtn.style.top = '10px';
        deleteBtn.style.right = '10px';
        deleteBtn.style.background = '#8b0000';
        deleteBtn.style.color = '#fff';
        deleteBtn.style.border = '2px solid #3c3c3c';
        deleteBtn.style.fontFamily = '"Mojangles", sans-serif';
        deleteBtn.style.cursor = 'pointer';
        deleteBtn.style.padding = '4px 8px';
        deleteBtn.style.zIndex = '10';

        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            removeCustomLink(index);
        });

        slotWrapper.appendChild(linkAnchor);
        slotWrapper.appendChild(deleteBtn);
        userGrid.appendChild(slotWrapper);
    });
}

if (saveLinkBtn && customNameInput && customUrlInput) {
    saveLinkBtn.addEventListener('click', () => {
        if (clickAudio) {
            clickAudio.currentTime = 0;
            clickAudio.play().catch(err => console.log(err));
        }
        const name = customNameInput.value.trim();
        let url = customUrlInput.value.trim();

        if (name && url) {
            if (!url.startsWith('http://') && !url.startsWith('https://')) {
                url = 'https://' + url;
            }
            const saved = JSON.parse(localStorage.getItem('userSavedLinks') || '[]');
            saved.push({ name, url });
            localStorage.setItem('userSavedLinks', JSON.stringify(saved));
            
            customNameInput.value = '';
            customUrlInput.value = '';
            renderUserSavedLinks();
        }
    });
}

const backFromG8mesBtn = document.getElementById('to-menu-from-links');

if (backFromG8mesBtn) {
    backFromG8mesBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (clickAudio) {
            clickAudio.currentTime = 0;
            clickAudio.play().catch(err => console.log(err));
        }
        if (g8mesView) g8mesView.classList.add('hidden');
        if (menuView) menuView.classList.remove('hidden');
        window.location.hash = 'menu';
    });
}

const tabContainer = document.getElementById('mc-tabbed-container');
const tabToggleBtn = document.getElementById('tab-toggle-btn');
const paneCreate = document.getElementById('tab-content-create');
const paneLoad = document.getElementById('tab-content-load');

if (tabToggleBtn && tabContainer) {
    if (paneCreate) paneCreate.style.display = 'block';
    if (paneLoad) paneLoad.style.display = 'none';
    
    tabToggleBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (clickAudio) {
            clickAudio.currentTime = 0;
            clickAudio.play().catch(err => console.log(err));
        }
        if (tabContainer.classList.contains('mc-tab-bg-create') || tabContainer.className === 'mc-tab-bg-create') {
            tabContainer.className = 'mc-tab-bg-load';
            if (paneLoad) paneLoad.style.display = 'block';
            if (paneCreate) paneCreate.style.display = 'none';
        } else {
            tabContainer.className = 'mc-tab-bg-create';
            if (paneCreate) paneCreate.style.display = 'block';
            if (paneLoad) paneLoad.style.display = 'none';
        }
    });
}

const staticLinks = document.querySelectorAll('.target-portal-link');

staticLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        
        if (clickAudio) {
            clickAudio.currentTime = 0;
            clickAudio.play().catch(err => console.log(err));
        }
        
        window.open(link.href, '_blank');
    });
});

let allG8mesList = []; 

async function loadG8mes() {
    const g8mesGrid = document.getElementById("g8mes-grid");
    if (!g8mesGrid) return;

    try {
        const response = await fetch("./g8mes.json");

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        allG8mesList = await response.json(); 
        renderG8mesList(allG8mesList);

    } catch (error) {
        console.error("G8me loading error:", error);
        g8mesGrid.innerHTML = "<p style='font-family: \"Mojangles\"; color: white;'>Failed to load g8mes.</p>";
    }
}

function renderG8mesList(g8mesArray) {
    const g8mesGrid = document.getElementById("g8mes-grid");
    if (!g8mesGrid) return;

    g8mesGrid.innerHTML = "";

    if (g8mesArray.length === 0) {
        g8mesGrid.innerHTML = "<p style='grid-column: span 2; text-align: center; font-family: \"Mojangles\"; color: white;'>No g8mes found.</p>";
        return;
    }

    g8mesArray.forEach(g8me => {
        const button = document.createElement("a");
        button.className = "custom-button";
        button.href = new URL(g8me.url, window.location.href).href;
        button.textContent = g8me.name;
        
        button.style.width = "100%";
        button.style.boxSizing = "border-box";
        button.style.marginTop = "10px"; 

        g8mesGrid.appendChild(button);
    });
}

document.addEventListener("DOMContentLoaded", () => {
    const searchInput = document.getElementById("g8me-search-input");
    if (searchInput) {
        searchInput.addEventListener("input", (e) => {
            const searchTerm = e.target.value.toLowerCase().trim();
            
            const filteredG8mes = allG8mesList.filter(g8me => 
                g8me.name.toLowerCase().includes(searchTerm)
            );
            
            renderG8mesList(filteredG8mes);
        });
    }
});

loadG8mes();

const musicTracks = [
    document.getElementById('Menu1'),
    document.getElementById('Menu2'),
    document.getElementById('Menu3')
];

let currentPlayingTrack = null;

function playRandomTrack() {
    if (currentPlayingTrack) {
        currentPlayingTrack.pause();
        currentPlayingTrack.currentTime = 0;
    }

    const randomIndex = Math.floor(Math.random() * musicTracks.length);
    currentPlayingTrack = musicTracks[randomIndex];

    if (currentPlayingTrack) {
        const savedMuteSetting = localStorage.getItem('siteMuted') === 'true';
        currentPlayingTrack.muted = savedMuteSetting;

        currentPlayingTrack.play()
            .then(() => {
                currentPlayingTrack.onended = () => {
                    playRandomTrack();
                };
            })
            .catch(err => console.log("Music playback failed:", err));
    }
}

if (agreeButton) {
    agreeButton.addEventListener('click', () => {
        playRandomTrack();
    });
}

function applyMuteState(isMuted) {
    musicTracks.forEach(audio => {
        if (audio) audio.muted = isMuted;
    });
    
    if (clickAudio) clickAudio.muted = isMuted;

    if (isMuted) {
        if (muteIcon) muteIcon.textContent = "🔊";
        if (muteText) muteText.textContent = "Unmute";
    } else {
        if (muteIcon) muteIcon.textContent = "🔇";
        if (muteText) muteText.textContent = "Mute";
    }
}

if (muteBtn) {
    muteBtn.addEventListener('click', () => {
        if (clickAudio) {
            clickAudio.currentTime = 0;
            clickAudio.play().catch(err => console.log(err));
        }

        const nextMuteState = currentPlayingTrack ? !currentPlayingTrack.muted : true;
        applyMuteState(nextMuteState);
        localStorage.setItem('siteMuted', nextMuteState);
    });
}