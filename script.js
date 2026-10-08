import { links } from "./links.js";

const modal = document.getElementById('popupModal');
const agreeButton = document.querySelector('#popupModal .btn-close');

const menuAudio = document.getElementById('Menu1');
const clickAudio = document.getElementById('clickSound');

const menuView = document.getElementById('menu-view');
const g8mesView = document.getElementById('g8mes-view');
const creditsView = document.getElementById('credits-view');
const pr8xiesView = document.getElementById('pr8xies-view');
const optionsView = document.getElementById('options-view');

const toG8mesBtn = document.getElementById('to-g8mes-btn');
const toMenuBtn = document.getElementById('to-menu-btn');
const toCreditsBtn = document.getElementById('to-credits-btn');
const creditsExitBtn = document.getElementById('credits-exit-btn');
const toPr8xiesBtn = document.getElementById('to-pr8xies-btn');
const backFromPr8xiesBtn = document.getElementById('to-menu-from-pr8xies');
const toOptionsBtn = document.getElementById('to-options-btn');
const backFromOptionsBtn = document.getElementById('to-menu-from-options');

const proxyInput = document.getElementById('proxy-link-input');
const launchBtn = document.getElementById('launch-portal-btn');
const portalFrame = document.getElementById('portal-frame');

const titleInput = document.getElementById('tab-title-input');
const iconSelect = document.getElementById('tab-icon-select');
const saveOptionsBtn = document.getElementById('save-options-btn');
const faviconElement = document.getElementById('favicon-link');

const muteBtn = document.getElementById('mute-btn');
const muteIcon = document.getElementById('mute-icon');
const muteText = document.getElementById('mute-text');

const aboutBlankBtn = document.getElementById('about-blank-btn');

const userGrid = document.getElementById('user-links-grid');
const builtInLinksGrid = document.getElementById('built-in-links-grid');
const customNameInput = document.getElementById('custom-link-name');
const customUrlInput = document.getElementById('custom-link-url');
const saveLinkBtn = document.getElementById('save-custom-link-btn');

const backFromG8mesBtn = document.getElementById('to-menu-from-links');

const tabContainer = document.getElementById('mc-tabbed-container');
const tabToggleBtn = document.getElementById('tab-toggle-btn');
const paneCreate = document.getElementById('tab-content-create');
const paneLoad = document.getElementById('tab-content-load');

const allAudioElements = document.querySelectorAll('audio');

const musicTracks = [
    document.getElementById('Menu1'),
    document.getElementById('Menu2'),
    document.getElementById('Menu3')
].filter(track => track);

let currentPlayingTrack = null;
let allG8mesList = [];

const BUILT_IN_LINK_BATCH_SIZE = 100;
let builtInLinksRendered = 0;
let builtInLinksLoadMoreButton = null;

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

function updateMuteText() {
    if (!muteText) {
        return;
    }

    const isMuted = localStorage.getItem('siteMuted') === 'true';

    muteText.textContent = isMuted ? 'Unmute' : 'Mute';
}

function applyMuteState(isMuted) {
    allAudioElements.forEach(audio => {
        audio.muted = isMuted;
    });

    if (muteIcon) {
        muteIcon.textContent = isMuted ? '🔇' : '🔊';
    }

    updateMuteText();
}

function navigateTo(currentView, targetView) {
    if (clickAudio) {
        clickAudio.currentTime = 0;
        clickAudio.play().catch(() => {});
    }

    if (currentView) {
        currentView.classList.add('hidden');
    }

    if (targetView) {
        targetView.classList.remove('hidden');
    }

    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            rebuildMinecraftButtons();
        });
    });
}

function ensureButtonText(button) {
    const existingText = button.querySelector(':scope > .button-text');

    if (existingText) {
        return existingText;
    }

    const textNodes = Array.from(button.childNodes).filter(node => {
        return (
            node.nodeType === Node.TEXT_NODE &&
            node.textContent.trim()
        );
    });

    if (textNodes.length === 0) {
        return null;
    }

    const textElement = document.createElement('span');

    textElement.className = 'button-text';

    textElement.textContent = textNodes
        .map(node => node.textContent.trim())
        .join(' ')
        .trim();

    textNodes.forEach(node => {
        node.remove();
    });

    button.appendChild(textElement);

    return textElement;
}

function buildMinecraftButton(button) {
    if (!button) {
        return;
    }

    let left = button.querySelector(':scope > .mc-left');
    let middle = button.querySelector(':scope > .mc-middle');
    let right = button.querySelector(':scope > .mc-right');

    if (!left) {
        left = document.createElement('span');
        left.className = 'mc-left';
        button.insertBefore(left, button.firstChild);
    }

    if (!middle) {
        middle = document.createElement('span');
        middle.className = 'mc-middle';
        button.insertBefore(middle, right || null);
    }

    if (!right) {
        right = document.createElement('span');
        right.className = 'mc-right';
        button.appendChild(right);
    }

    ensureButtonText(button);

    button.classList.add('mc-stretch-button');

    middle.innerHTML = '';

    const buttonWidth = button.getBoundingClientRect().width;
    const middleWidth = Math.max(0, buttonWidth - 10);

    let remaining = middleWidth;

    while (remaining > 0) {
        const tile = document.createElement('span');

        tile.className = 'mc-middle-tile';

        const tileWidth = Math.min(290, remaining);

        tile.style.flexBasis = `${tileWidth}px`;

        middle.appendChild(tile);

        remaining -= tileWidth;
    }
}

function rebuildMinecraftButtons() {
    document
        .querySelectorAll('.custom-button, .btn-close')
        .forEach(button => {
            if (button.getBoundingClientRect().width > 0) {
                buildMinecraftButton(button);
            }
        });
}

function renderBuiltInLinks(reset = false) {
    if (!builtInLinksGrid) {
        return;
    }

    if (reset) {
        builtInLinksGrid.innerHTML = '';
        builtInLinksRendered = 0;
        builtInLinksLoadMoreButton = null;
    }

    if (builtInLinksLoadMoreButton) {
        builtInLinksLoadMoreButton.remove();
        builtInLinksLoadMoreButton = null;
    }

    const start = builtInLinksRendered;
    const end = Math.min(
        start + BUILT_IN_LINK_BATCH_SIZE,
        links.length
    );

    const newLinks = [];

    for (let i = start; i < end; i++) {
        const item = links[i];

        const url = typeof item === 'string'
            ? item
            : item.url;

        const name = typeof item === 'string'
            ? `Unnamed Link ${i + 1}`
            : (item.name || `Unnamed Link ${i + 1}`);

        const link = document.createElement('a');

        link.href = '#';
        link.className = 'custom-button target-portal-link';

        const textElement = document.createElement('span');

        textElement.className = 'button-text';
        textElement.textContent = name;

        link.appendChild(textElement);

        link.addEventListener('click', e => {
            e.preventDefault();

            if (clickAudio) {
                clickAudio.currentTime = 0;
                clickAudio.play().catch(() => {});
            }

            window.open(url, '_blank', 'noopener,noreferrer');
        });

        newLinks.push(link);
    }

    newLinks.forEach(link => {
        builtInLinksGrid.appendChild(link);
    });

    builtInLinksRendered = end;

    requestAnimationFrame(() => {
        newLinks.forEach(link => {
            buildMinecraftButton(link);
        });

        if (builtInLinksRendered < links.length) {
            builtInLinksLoadMoreButton = document.createElement('button');

            builtInLinksLoadMoreButton.className =
                'custom-button load-more-button';

            const textElement = document.createElement('span');

            textElement.className = 'button-text';
            textElement.textContent =
                `Load More (${links.length - builtInLinksRendered} remaining)`;

            builtInLinksLoadMoreButton.appendChild(textElement);

            builtInLinksLoadMoreButton.addEventListener('click', () => {
                if (clickAudio) {
                    clickAudio.currentTime = 0;
                    clickAudio.play().catch(() => {});
                }

                renderBuiltInLinks(false);
            });

            builtInLinksGrid.appendChild(
                builtInLinksLoadMoreButton
            );

            buildMinecraftButton(
                builtInLinksLoadMoreButton
            );
        }
    });
}

function removeCustomLink(index) {
    if (clickAudio) {
        clickAudio.currentTime = 0;
        clickAudio.play().catch(() => {});
    }

    const saved = JSON.parse(
        localStorage.getItem('userSavedLinks') || '[]'
    );

    saved.splice(index, 1);

    localStorage.setItem(
        'userSavedLinks',
        JSON.stringify(saved)
    );

    renderUserSavedLinks();
}

function renderUserSavedLinks() {
    if (!userGrid) {
        return;
    }

    userGrid.innerHTML = '';

    const saved = JSON.parse(
        localStorage.getItem('userSavedLinks') || '[]'
    );

    saved.forEach((item, index) => {
        const slotWrapper = document.createElement('div');

        slotWrapper.style.position = 'relative';
        slotWrapper.style.display = 'inline-block';
        slotWrapper.style.width = '100%';

        const linkAnchor = document.createElement('a');

        linkAnchor.href = '#';
        linkAnchor.className = 'custom-button mc-stretch-button';
        linkAnchor.style.width = '100%';
        linkAnchor.style.boxSizing = 'border-box';

        const left = document.createElement('span');
        left.className = 'mc-left';

        const middle = document.createElement('span');
        middle.className = 'mc-middle';

        const right = document.createElement('span');
        right.className = 'mc-right';

        const textElement = document.createElement('span');
        textElement.className = 'button-text';
        textElement.textContent = item.name;

        linkAnchor.appendChild(left);
        linkAnchor.appendChild(middle);
        linkAnchor.appendChild(right);
        linkAnchor.appendChild(textElement);

        linkAnchor.addEventListener('click', e => {
            e.preventDefault();

            if (clickAudio) {
                clickAudio.currentTime = 0;
                clickAudio.play().catch(() => {});
            }

            window.open(item.url, '_blank', 'noopener,noreferrer');
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

        deleteBtn.addEventListener('click', e => {
            e.stopPropagation();
            removeCustomLink(index);
        });

        slotWrapper.appendChild(linkAnchor);
        slotWrapper.appendChild(deleteBtn);

        userGrid.appendChild(slotWrapper);

        buildMinecraftButton(linkAnchor);
    });
}

async function loadG8mes() {
    const g8mesGrid = document.getElementById('g8mes-grid');

    if (!g8mesGrid) {
        return;
    }

    try {
        const response = await fetch('./g8mes.json');

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        allG8mesList = await response.json();

        renderG8mesList(allG8mesList);
    } catch (error) {
        console.error('G8me loading error:', error);

        g8mesGrid.innerHTML =
            '<p style="font-family: Mojangles; color: white;">Failed to load g8mes.</p>';
    }
}

function renderG8mesList(g8mesArray) {
    const g8mesGrid = document.getElementById('g8mes-grid');

    if (!g8mesGrid) {
        return;
    }

    g8mesGrid.innerHTML = '';

    if (g8mesArray.length === 0) {
        g8mesGrid.innerHTML =
            '<p style="grid-column: span 2; text-align: center; font-family: Mojangles; color: white;">No g8mes found.</p>';

        return;
    }

    g8mesArray.forEach(g8me => {
        const button = document.createElement('a');

        button.className = 'custom-button';
        button.href = new URL(
            g8me.url,
            window.location.href
        ).href;

        button.textContent = g8me.name;

        button.style.width = '100%';
        button.style.boxSizing = 'border-box';
        button.style.marginTop = '10px';

        g8mesGrid.appendChild(button);
    });
}

function playRandomTrack() {
    if (currentPlayingTrack) {
        currentPlayingTrack.pause();
        currentPlayingTrack.currentTime = 0;
        currentPlayingTrack.onended = null;
    }

    if (musicTracks.length === 0) {
        return;
    }

    const randomIndex = Math.floor(
        Math.random() * musicTracks.length
    );

    currentPlayingTrack = musicTracks[randomIndex];

    const savedMuteSetting =
        localStorage.getItem('siteMuted') === 'true';

    currentPlayingTrack.muted = savedMuteSetting;

    currentPlayingTrack.play()
        .then(() => {
            currentPlayingTrack.onended = () => {
                playRandomTrack();
            };
        })
        .catch(error => {
            console.log('Music playback failed:', error);
        });
}

if (agreeButton) {
    agreeButton.addEventListener('click', () => {
        playRandomTrack();
    });
}

if (toG8mesBtn) {
    toG8mesBtn.addEventListener('click', e => {
        e.preventDefault();
        navigateTo(menuView, g8mesView);
    });
}

if (toMenuBtn) {
    toMenuBtn.addEventListener('click', e => {
        e.preventDefault();
        navigateTo(g8mesView, menuView);
    });
}

if (toCreditsBtn) {
    toCreditsBtn.addEventListener('click', e => {
        e.preventDefault();
        navigateTo(menuView, creditsView);
    });
}

if (creditsExitBtn) {
    creditsExitBtn.addEventListener('click', e => {
        e.preventDefault();
        navigateTo(creditsView, menuView);
    });
}

if (toPr8xiesBtn) {
    toPr8xiesBtn.addEventListener('click', e => {
        e.preventDefault();
        navigateTo(menuView, pr8xiesView);
    });
}

if (backFromPr8xiesBtn) {
    backFromPr8xiesBtn.addEventListener('click', e => {
        e.preventDefault();
        navigateTo(pr8xiesView, menuView);
    });
}

if (toOptionsBtn) {
    toOptionsBtn.addEventListener('click', e => {
        e.preventDefault();
        navigateTo(menuView, optionsView);
    });
}

if (backFromOptionsBtn) {
    backFromOptionsBtn.addEventListener('click', e => {
        e.preventDefault();
        navigateTo(optionsView, menuView);
    });
}

if (launchBtn && proxyInput && portalFrame) {
    launchBtn.addEventListener('click', () => {
        let cleanUrl = proxyInput.value.trim();

        if (!cleanUrl) {
            return;
        }

        if (
            !cleanUrl.startsWith('http://') &&
            !cleanUrl.startsWith('https://')
        ) {
            cleanUrl = 'https://' + cleanUrl;
        }

        portalFrame.src = cleanUrl;
    });
}

if (saveOptionsBtn && titleInput && iconSelect) {
    saveOptionsBtn.addEventListener('click', () => {
        if (clickAudio) {
            clickAudio.currentTime = 0;
            clickAudio.play().catch(() => {});
        }

        const userTitle = titleInput.value.trim();
        const userIcon = iconSelect.value;

        if (userTitle) {
            document.title = userTitle;

            localStorage.setItem(
                'customTabTitle',
                userTitle
            );
        } else {
            document.title = 'New Tab';

            localStorage.removeItem(
                'customTabTitle'
            );
        }

        if (faviconElement) {
            if (userIcon) {
                localStorage.setItem(
                    'customTabIcon',
                    userIcon
                );

                faviconElement.setAttribute(
                    'href',
                    userIcon
                );
            } else {
                localStorage.removeItem(
                    'customTabIcon'
                );

                faviconElement.setAttribute(
                    'href',
                    'favicon.ico'
                );

                faviconElement.setAttribute(
                    'type',
                    'image/x-icon'
                );
            }
        }

        alert('Disguise applied successfully!');
    });
}

if (aboutBlankBtn) {
    aboutBlankBtn.addEventListener('click', (e) => {
        e.preventDefault();

        // Open a new blank tab
        const win = window.open('about:blank', '_blank');

        if (!win) {
            alert('Pop-up blocked! Please allow pop-ups for this site to use about:blank mode.');
            return;
        }

        const doc = win.document;
        doc.open();

        // Set base URL so relative images, CSS, and resources load correctly
        const baseUrl = window.location.href;

        doc.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <base href="${baseUrl}">
                <title>${document.title}</title>
                <style>
                    html, body {
                        margin: 0;
                        padding: 0;
                        width: 100vw;
                        height: 100vh;
                        overflow: hidden;
                        background-color: #000;
                    }
                    iframe {
                        width: 100%;
                        height: 100%;
                        border: none;
                    }
                </style>
            </head>
            <body>
                <iframe src="${baseUrl}"></iframe>
            </body>
            </html>
        `);

        doc.close();

        // Optional: Redirect current page to a safe cover page (e.g., Google)
        window.location.replace('https://www.google.com');
    });
}

if (muteBtn) {
    muteBtn.addEventListener('click', () => {
        const currentMuted =
            localStorage.getItem('siteMuted') === 'true';

        const nextMuteState = !currentMuted;

        localStorage.setItem(
            'siteMuted',
            nextMuteState
        );

        applyMuteState(nextMuteState);
    });
}

if (saveLinkBtn && customNameInput && customUrlInput) {
    saveLinkBtn.addEventListener('click', () => {
        if (clickAudio) {
            clickAudio.currentTime = 0;
            clickAudio.play().catch(() => {});
        }

        const name = customNameInput.value.trim();
        let url = customUrlInput.value.trim();

        if (!name || !url) {
            return;
        }

        if (
            !url.startsWith('http://') &&
            !url.startsWith('https://')
        ) {
            url = 'https://' + url;
        }

        const saved = JSON.parse(
            localStorage.getItem('userSavedLinks') || '[]'
        );

        saved.push({
            name: name,
            url: url
        });

        localStorage.setItem(
            'userSavedLinks',
            JSON.stringify(saved)
        );

        customNameInput.value = '';
        customUrlInput.value = '';

        renderUserSavedLinks();
    });
}

if (backFromG8mesBtn) {
    backFromG8mesBtn.addEventListener('click', e => {
        e.preventDefault();

        navigateTo(g8mesView, menuView);

        window.location.hash = 'menu';
    });
}

if (tabToggleBtn && tabContainer) {
    tabToggleBtn.addEventListener('click', e => {
        e.preventDefault();

        if (clickAudio) {
            clickAudio.currentTime = 0;
            clickAudio.play().catch(() => {});
        }

        const isCreate =
            tabContainer.classList.contains('mc-tab-bg-create');

        if (isCreate) {
            tabContainer.classList.remove('mc-tab-bg-create');
            tabContainer.classList.add('mc-tab-bg-load');

            if (paneCreate) {
                paneCreate.style.display = 'none';
            }

            if (paneLoad) {
                paneLoad.style.display = 'block';
            }

            if (builtInLinksRendered === 0) {
                renderBuiltInLinks(true);
            }

            renderUserSavedLinks();

            requestAnimationFrame(() => {
                rebuildMinecraftButtons();
});
        } else {
            tabContainer.classList.remove('mc-tab-bg-load');
            tabContainer.classList.add('mc-tab-bg-create');

            if (paneCreate) {
                paneCreate.style.display = 'block';
            }

            if (paneLoad) {
                paneLoad.style.display = 'none';
            }

            requestAnimationFrame(() => {
                rebuildMinecraftButtons();
            });
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    const searchInput =
        document.getElementById('g8me-search-input');

    if (searchInput) {
        searchInput.addEventListener('input', e => {
            const searchTerm =
                e.target.value.toLowerCase().trim();

            const filteredG8mes =
                allG8mesList.filter(g8me =>
                    g8me.name
                        .toLowerCase()
                        .includes(searchTerm)
                );

            renderG8mesList(filteredG8mes);
        });
    }

    const savedTitle =
        localStorage.getItem('customTabTitle');

    const savedIcon =
        localStorage.getItem('customTabIcon');

    if (savedTitle) {
        document.title = savedTitle;

        if (titleInput) {
            titleInput.value = savedTitle;
        }
    }

    if (savedIcon && faviconElement) {
        faviconElement.setAttribute(
            'href',
            savedIcon
        );

        if (iconSelect) {
            iconSelect.value = savedIcon;
        }
    }

    const savedMuteSetting =
        localStorage.getItem('siteMuted') === 'true';

    applyMuteState(savedMuteSetting);

    renderUserSavedLinks();

    const splashElements =
        document.querySelectorAll('.splash-text');

    if (splashElements.length > 0) {
        const randomIndex =
            Math.floor(
                Math.random() * splashes.length
            );

        const chosenSplash =
            splashes[randomIndex];

        splashElements.forEach(element => {
            element.textContent = chosenSplash;
        });
    }

    if (modal) {
        modal.showModal();
    }

    const backgrounds = [
        'images/background.png',
        'images/background2.png',
        'images/background3.png',
        'images/background4.png'
    ];

    const randomBgIndex =
        Math.floor(
            Math.random() * backgrounds.length
        );

    document.body.style.backgroundImage =
        `linear-gradient(rgba(0,0,0,0.3), rgba(0,0,0,0.3)), url('${backgrounds[randomBgIndex]}')`;

    requestAnimationFrame(() => {
        rebuildMinecraftButtons();
    });
});

window.addEventListener('resize', () => {
    rebuildMinecraftButtons();
});

window.addEventListener('load', () => {
    rebuildMinecraftButtons();
});

loadG8mes();