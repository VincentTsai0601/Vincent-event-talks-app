// State Management
let releasesData = [];
let starredIds = new Set(JSON.parse(localStorage.getItem('bq_starred_ids') || '[]'));
let currentTab = 'all'; // 'all' or 'starred'
let selectedTypeFilter = 'all';
let isFetching = false;
let currentModalItem = null;

// Initialize Web Application
document.addEventListener('DOMContentLoaded', () => {
    // Load persisted theme
    const savedTheme = localStorage.getItem('bq_theme') || 'dark';
    if (savedTheme === 'light') {
        document.body.classList.remove('dark-theme');
        document.body.classList.add('light-theme');
    } else {
        document.body.classList.add('dark-theme');
        document.body.classList.remove('light-theme');
    }

    // Load initial data
    fetchReleases(false);
    updateStarredCount();
});

// Fetch Data from Flask API
async function fetchReleases(isManualRefresh = false) {
    if (isFetching) return;
    
    isFetching = true;
    const refreshBtn = document.getElementById('refreshBtn');
    const refreshIcon = document.getElementById('refreshIcon');
    const loader = document.getElementById('mainLoader');
    const timelineFeed = document.getElementById('timelineFeed');
    const syncStatus = document.getElementById('syncStatus');
    const statusText = document.getElementById('statusText');
    const statusDot = syncStatus.querySelector('.status-dot');

    // UI Updates for Fetching state
    if (refreshBtn) refreshBtn.disabled = true;
    if (refreshIcon) refreshIcon.classList.add('spin');
    
    if (isManualRefresh) {
        showToast('Refreshing release notes...', 'info');
    } else {
        loader.style.display = 'flex';
        timelineFeed.style.display = 'none';
    }

    // Update Status to Syncing
    statusText.textContent = "Syncing with Google Cloud...";
    statusDot.className = "status-dot pulsing";

    try {
        const url = `/api/releases${isManualRefresh ? '?refresh=true' : ''}`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.status === 'success') {
            releasesData = data.releases || [];
            
            // Set Connection Status Dot
            if (data.source === 'live') {
                statusDot.className = "status-dot live pulsing";
                statusText.textContent = "Live Sync Active";
            } else {
                statusDot.className = "status-dot cached pulsing";
                statusText.textContent = "Cached Mode (Live Rate-Limited)";
                if (isManualRefresh) {
                    showToast('Showing cached data. Google API is rate-limiting requests.', 'warning');
                }
            }

            // Render components
            calculateInsights();
            applyFilters();
        } else {
            throw new Error(data.message || 'Unknown server error');
        }
    } catch (error) {
        console.error('Fetch error:', error);
        statusDot.className = "status-dot error pulsing";
        statusText.textContent = "Sync Failed (Offline)";
        showToast('Failed to sync releases. Using offline data.', 'error');
        
        if (releasesData.length === 0) {
            // If data is empty and fetch failed, load minimal empty UI
            timelineFeed.style.display = 'none';
            document.getElementById('emptyState').style.display = 'block';
        }
    } finally {
        isFetching = false;
        if (refreshBtn) refreshBtn.disabled = false;
        if (refreshIcon) refreshIcon.classList.remove('spin');
        loader.style.display = 'none';
        timelineFeed.style.display = 'block';
    }
}

// Calculate Insights and stats for Sidebar
function calculateInsights() {
    let featureCount = 0;
    let fixCount = 0;
    let totalUpdates = 0;

    // Flatten all updates to calculate stats
    releasesData.forEach(release => {
        if (release.updates) {
            release.updates.forEach(update => {
                totalUpdates++;
                if (update.type === 'Feature') featureCount++;
                else if (update.type === 'Fix') fixCount++;
            });
        }
    });

    const otherCount = totalUpdates - (featureCount + fixCount);

    // Update numbers
    document.getElementById('statFeats').textContent = featureCount;
    document.getElementById('statFixes').textContent = fixCount;

    // Calculate Percentages
    const featPct = totalUpdates > 0 ? Math.round((featureCount / totalUpdates) * 100) : 0;
    const fixPct = totalUpdates > 0 ? Math.round((fixCount / totalUpdates) * 100) : 0;
    const otherPct = totalUpdates > 0 ? Math.round((otherCount / totalUpdates) * 100) : 0;

    document.getElementById('pctFeats').textContent = `${featPct}%`;
    document.getElementById('pctFixes').textContent = `${fixPct}%`;
    document.getElementById('pctOthers').textContent = `${otherPct}%`;

    // Fill bars
    document.getElementById('barFeats').style.width = `${featPct}%`;
    document.getElementById('barFixes').style.width = `${fixPct}%`;
    document.getElementById('barOthers').style.width = `${otherPct}%`;
}

// Apply Search, Filter, Sort and Star filters
function applyFilters() {
    const searchInput = document.getElementById('searchInput');
    const query = searchInput.value.toLowerCase().trim();
    const sortOrder = document.getElementById('sortOrder').value;
    const timelineFeed = document.getElementById('timelineFeed');
    const emptyState = document.getElementById('emptyState');
    
    // Toggle clear search button visibility
    const clearSearchBtn = document.getElementById('clearSearchBtn');
    if (query) {
        clearSearchBtn.style.display = 'block';
    } else {
        clearSearchBtn.style.display = 'none';
    }

    // Process and filter
    let filteredReleases = [];

    releasesData.forEach(release => {
        // Filter the individual updates inside this release date group
        const matchingUpdates = (release.updates || []).filter(update => {
            // Tab filter (Starred vs All)
            if (currentTab === 'starred' && !starredIds.has(getStarredKey(release.date, update.content_text))) {
                return false;
            }

            // Type filter
            if (selectedTypeFilter !== 'all' && update.type !== selectedTypeFilter) {
                return false;
            }

            // Keyword search filter
            if (query) {
                const titleMatch = release.title.toLowerCase().includes(query);
                const textMatch = update.content_text.toLowerCase().includes(query);
                const typeMatch = update.type.toLowerCase().includes(query);
                const catMatch = (update.category || '').toLowerCase().includes(query);
                return titleMatch || textMatch || typeMatch || catMatch;
            }

            return true;
        });

        // If there are updates matching in this date group, keep the release group
        if (matchingUpdates.length > 0) {
            filteredReleases.push({
                ...release,
                updates: matchingUpdates
            });
        }
    });

    // Sorting of Release Date Groups
    if (sortOrder === 'oldest') {
        filteredReleases.sort((a, b) => new Date(a.date) - new Date(b.date));
    } else {
        filteredReleases.sort((a, b) => new Date(b.date) - new Date(a.date));
    }

    // Render Timeline
    renderTimeline(filteredReleases);

    // Empty state handling
    if (filteredReleases.length === 0) {
        timelineFeed.style.display = 'none';
        emptyState.style.display = 'block';
    } else {
        timelineFeed.style.display = 'block';
        emptyState.style.display = 'none';
    }
}

// Key generator for Starring updates (date + text hashing)
function getStarredKey(date, text) {
    // Generate a simple unique key based on release date and update text
    return `${date}_${text.slice(0, 50).replace(/[^a-zA-Z0-9]/g, '')}`;
}

// Render Timeline Feed
function renderTimeline(releases) {
    const timelineFeed = document.getElementById('timelineFeed');
    timelineFeed.innerHTML = '';

    releases.forEach((release, groupIndex) => {
        const dateGroup = document.createElement('div');
        dateGroup.className = 'timeline-date-group';
        
        const dateNode = document.createElement('div');
        dateNode.className = 'timeline-date-node';
        
        const dateTitle = document.createElement('h3');
        dateTitle.className = 'timeline-date-title';
        
        // Format Date nicely: "June 18, 2026"
        const formattedDate = formatDateString(release.date);
        dateTitle.innerHTML = `<i class="fa-regular fa-calendar"></i> ${formattedDate}`;
        
        dateGroup.appendChild(dateNode);
        dateGroup.appendChild(dateTitle);

        // Render cards inside this date group
        release.updates.forEach((update, updateIndex) => {
            const starKey = getStarredKey(release.date, update.content_text);
            const isStarred = starredIds.has(starKey);
            
            const card = document.createElement('article');
            card.className = 'timeline-card animate-card';
            card.style.animationDelay = `${(groupIndex * 2 + updateIndex) * 0.05}s`;
            
            // Set up click handler to open modal
            card.onclick = () => openModal({
                ...update,
                releaseTitle: release.title,
                releaseDate: release.date,
                releaseLink: release.link,
                starKey: starKey
            });

            // Card Header
            const cardHeader = document.createElement('header');
            cardHeader.className = 'card-header';

            const cardMeta = document.createElement('div');
            cardMeta.className = 'card-meta';

            const badgeTag = document.createElement('span');
            const badgeClass = update.badge ? update.badge.toLowerCase() : 'info';
            badgeTag.className = `badge-tag ${update.type.toLowerCase() === 'feature' ? 'feature-' + badgeClass : badgeClass}`;
            badgeTag.textContent = `${update.type} ${update.badge !== update.type && update.badge !== 'GA' && update.badge !== 'Fix' ? '(' + update.badge + ')' : ''}`;
            cardMeta.appendChild(badgeTag);

            if (update.category && update.category !== 'General') {
                const categoryTag = document.createElement('span');
                categoryTag.className = 'category-tag';
                categoryTag.textContent = update.category;
                cardMeta.appendChild(categoryTag);
            }

            const cardActions = document.createElement('div');
            cardActions.className = 'card-actions';

            const tweetBtn = document.createElement('button');
            tweetBtn.className = 'tweet-card-btn';
            tweetBtn.setAttribute('aria-label', 'Tweet update');
            tweetBtn.innerHTML = '<i class="fa-brands fa-twitter"></i>';
            tweetBtn.onclick = (e) => {
                e.stopPropagation(); // Prevent opening modal
                openTwitterComposerFromCard({
                    ...update,
                    releaseTitle: release.title,
                    releaseDate: release.date,
                    releaseLink: release.link,
                    starKey: starKey
                });
            };

            const starBtn = document.createElement('button');
            starBtn.className = `star-btn ${isStarred ? 'active' : ''}`;
            starBtn.setAttribute('aria-label', isStarred ? 'Unstar update' : 'Star update');
            starBtn.innerHTML = isStarred ? '<i class="fa-solid fa-star"></i>' : '<i class="fa-regular fa-star"></i>';
            starBtn.onclick = (e) => {
                e.stopPropagation(); // Prevent opening modal
                toggleStar(starKey, starBtn);
            };

            cardActions.appendChild(tweetBtn);
            cardActions.appendChild(starBtn);
            cardHeader.appendChild(cardMeta);
            cardHeader.appendChild(cardActions);

            // Card Body
            const cardBody = document.createElement('div');
            cardBody.className = 'card-body';
            cardBody.innerHTML = update.content_html;

            card.appendChild(cardHeader);
            card.appendChild(cardBody);
            dateGroup.appendChild(card);
        });

        timelineFeed.appendChild(dateGroup);
    });
}

// Format Date string to a beautiful date format
function formatDateString(dateStr) {
    if (!dateStr) return 'General Announcement';
    
    // Check if ISO format (YYYY-MM-DD)
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        const options = { year: 'numeric', month: 'long', day: 'numeric' };
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', options);
    }
    
    return dateStr;
}

// Starring/Bookmarking Actions
function toggleStar(key, btnElement) {
    if (starredIds.has(key)) {
        starredIds.delete(key);
        if (btnElement) {
            btnElement.classList.remove('active');
            btnElement.innerHTML = '<i class="fa-regular fa-star"></i>';
        }
        showToast('Removed from starred updates', 'info');
    } else {
        starredIds.add(key);
        if (btnElement) {
            btnElement.classList.add('active');
            btnElement.innerHTML = '<i class="fa-solid fa-star"></i>';
        }
        showToast('Added to starred updates!', 'success');
    }
    
    // Persist
    localStorage.setItem('bq_starred_ids', JSON.stringify(Array.from(starredIds)));
    updateStarredCount();
    
    // Reapply filter if currently in starred tab
    if (currentTab === 'starred') {
        applyFilters();
    }
}

function updateStarredCount() {
    const badge = document.getElementById('starredBadge');
    if (badge) {
        badge.textContent = starredIds.size;
    }
}

// Switch Tabs between All and Starred
function switchTab(tab) {
    currentTab = tab;
    
    const navAll = document.getElementById('navAll');
    const navStarred = document.getElementById('navStarred');
    const pageTitle = document.getElementById('pageTitle');
    
    if (tab === 'starred') {
        navAll.classList.remove('active');
        navStarred.classList.add('active');
        pageTitle.textContent = "Starred Updates";
    } else {
        navAll.classList.add('active');
        navStarred.classList.remove('active');
        pageTitle.textContent = "BigQuery Release Notes";
    }
    
    applyFilters();
}

// Filter Tags Action
function filterByType(type) {
    selectedTypeFilter = type;
    
    const filterTags = document.querySelectorAll('#typeFilters .filter-tag');
    filterTags.forEach(tag => {
        if (tag.getAttribute('data-type') === type) {
            tag.classList.add('active');
        } else {
            tag.classList.remove('active');
        }
    });
    
    applyFilters();
}

// Clear Search Input
function clearSearch() {
    const searchInput = document.getElementById('searchInput');
    searchInput.value = '';
    applyFilters();
    searchInput.focus();
}

// Reset All Filters
function resetFilters() {
    document.getElementById('searchInput').value = '';
    selectedTypeFilter = 'all';
    document.getElementById('sortOrder').value = 'newest';
    
    const filterTags = document.querySelectorAll('#typeFilters .filter-tag');
    filterTags.forEach(tag => {
        if (tag.getAttribute('data-type') === 'all') {
            tag.classList.add('active');
        } else {
            tag.classList.remove('active');
        }
    });
    
    applyFilters();
}

// Modal View Details
function openModal(item) {
    currentModalItem = item;
    
    const modal = document.getElementById('detailsModal');
    const modalBadge = document.getElementById('modalBadge');
    const modalCategory = document.getElementById('modalCategory');
    const modalTitle = document.getElementById('modalTitle');
    const modalDate = document.getElementById('modalDate');
    const modalSourceLink = document.getElementById('modalSourceLink');
    const modalContentHtml = document.getElementById('modalContentHtml');
    const modalStarBtn = document.getElementById('modalStarBtn');

    // Setup modal elements
    modalTitle.textContent = cleanTitleText(item.content_text);
    modalDate.textContent = formatDateString(item.releaseDate);
    modalSourceLink.href = item.releaseLink || "https://cloud.google.com/bigquery/docs/release-notes";
    modalContentHtml.innerHTML = item.content_html;
    
    // Set Badge class
    const badgeClass = item.badge ? item.badge.toLowerCase() : 'info';
    modalBadge.className = `modal-badge ${item.type.toLowerCase() === 'feature' ? 'feature-' + badgeClass : badgeClass}`;
    modalBadge.textContent = `${item.type} ${item.badge !== item.type && item.badge !== 'GA' && item.badge !== 'Fix' ? '(' + item.badge + ')' : ''}`;
    
    if (item.category && item.category !== 'General') {
        modalCategory.style.display = 'inline-block';
        modalCategory.textContent = item.category;
    } else {
        modalCategory.style.display = 'none';
    }

    // Set Star Button State in Modal
    const isStarred = starredIds.has(item.starKey);
    if (isStarred) {
        modalStarBtn.classList.add('active');
        modalStarBtn.innerHTML = '<i class="fa-solid fa-star"></i> <span>Starred</span>';
    } else {
        modalStarBtn.classList.remove('active');
        modalStarBtn.innerHTML = '<i class="fa-regular fa-star"></i> <span>Star this update</span>';
    }

    modal.classList.add('active');
    document.body.style.overflow = 'hidden'; // Lock background scroll
}

function closeModal(event) {
    // If event is provided, verify it was click on overlay, not card content
    if (event && event.target !== document.getElementById('detailsModal')) return;
    
    const modal = document.getElementById('detailsModal');
    modal.classList.remove('active');
    document.body.style.overflow = ''; // Unlock scroll
    currentModalItem = null;
}

// Clean title from full text body (removes prefixes)
function cleanTitleText(text) {
    // Strip "Feature (GA):" or "Fix:" prefixes for the modal title
    return text.replace(/^(Feature|Fix|Change|Deprecation|Note)\s*(\([A-Za-z]+\))?:?\s*/i, '');
}

// Star toggle specifically for Modal button
function toggleStarFromModal() {
    if (!currentModalItem) return;
    
    const starBtn = document.getElementById('modalStarBtn');
    toggleStar(currentModalItem.starKey, null);
    
    // Sync state visual on modal button
    const isStarred = starredIds.has(currentModalItem.starKey);
    if (isStarred) {
        starBtn.classList.add('active');
        starBtn.innerHTML = '<i class="fa-solid fa-star"></i> <span>Starred</span>';
    } else {
        starBtn.classList.remove('active');
        starBtn.innerHTML = '<i class="fa-regular fa-star"></i> <span>Star this update</span>';
    }

    // Reapply filters to sync the list in the background
    applyFilters();
}

// Copy URL link to clipboard
function copyModalLink() {
    if (!currentModalItem) return;
    
    const link = currentModalItem.releaseLink || "https://cloud.google.com/bigquery/docs/release-notes";
    navigator.clipboard.writeText(link).then(() => {
        showToast('Link copied to clipboard!', 'success');
    }).catch(err => {
        console.error('Failed to copy: ', err);
        showToast('Failed to copy link.', 'error');
    });
}

// Toast Notifications
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    const toastIcon = document.getElementById('toastIcon');
    const toastMessage = document.getElementById('toastMessage');
    
    toastMessage.textContent = message;
    
    // Set icons and colors based on notification type
    if (type === 'success') {
        toast.style.borderLeftColor = 'var(--color-feature)';
        toastIcon.className = 'fa-solid fa-circle-check toast-icon';
        toastIcon.style.color = 'var(--color-feature)';
    } else if (type === 'warning') {
        toast.style.borderLeftColor = 'var(--color-change)';
        toastIcon.className = 'fa-solid fa-circle-exclamation toast-icon';
        toastIcon.style.color = 'var(--color-change)';
    } else if (type === 'error') {
        toast.style.borderLeftColor = 'var(--color-deprecation)';
        toastIcon.className = 'fa-solid fa-circle-xmark toast-icon';
        toastIcon.style.color = 'var(--color-deprecation)';
    } else {
        toast.style.borderLeftColor = 'var(--color-primary)';
        toastIcon.className = 'fa-solid fa-circle-info toast-icon';
        toastIcon.style.color = 'var(--color-primary)';
    }
    
    toast.classList.add('active');
    
    // Remove after 3 seconds
    setTimeout(() => {
        toast.classList.remove('active');
    }, 3000);
}

// Theme Toggle Action
function toggleTheme() {
    const body = document.body;
    if (body.classList.contains('dark-theme')) {
        body.classList.remove('dark-theme');
        body.classList.add('light-theme');
        localStorage.setItem('bq_theme', 'light');
        showToast('Switched to light theme', 'info');
    } else {
        body.classList.remove('light-theme');
        body.classList.add('dark-theme');
        localStorage.setItem('bq_theme', 'dark');
        showToast('Switched to dark theme', 'info');
    }
}

// Twitter Composer Logic
let currentComposerItem = null;

function openTwitterComposer() {
    if (!currentModalItem) return;
    closeModal(null);
    setupTwitterComposer(currentModalItem);
}

function openTwitterComposerFromCard(item) {
    setupTwitterComposer(item);
}

function setupTwitterComposer(item) {
    currentComposerItem = item;
    
    const twitterModal = document.getElementById('twitterModal');
    const tweetTextArea = document.getElementById('tweetTextArea');
    const attachmentUrlText = document.getElementById('attachmentUrlText');
    
    const categoryHash = item.category && item.category !== 'General' ? ` #${item.category.replace(/[^a-zA-Z0-9]/g, '')}` : '';
    const cleanText = cleanTitleText(item.content_text);
    const draftText = `Google Cloud BigQuery Update:\n\n"${cleanText}"\n\n#BigQuery #GoogleCloud${categoryHash}`;
    
    tweetTextArea.value = draftText;
    
    const docLink = item.releaseLink || "https://cloud.google.com/bigquery/docs/release-notes";
    attachmentUrlText.textContent = docLink.replace(/^https?:\/\//, '');
    
    updateTweetLength();
    
    twitterModal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeTwitterComposer(event) {
    if (event && event.target !== document.getElementById('twitterModal')) return;
    
    const twitterModal = document.getElementById('twitterModal');
    twitterModal.classList.remove('active');
    document.body.style.overflow = '';
    currentComposerItem = null;
}

function updateTweetLength() {
    const tweetTextArea = document.getElementById('tweetTextArea');
    const charCount = document.getElementById('tweetCharCount');
    const warningText = document.getElementById('charCountWarning');
    const countContainer = charCount.parentElement;
    const postBtn = document.getElementById('postTweetBtn');
    
    const length = tweetTextArea.value.length;
    charCount.textContent = length;
    
    if (length > 280) {
        countContainer.classList.add('warning');
        warningText.style.display = 'inline';
        postBtn.disabled = true;
    } else {
        countContainer.classList.remove('warning');
        warningText.style.display = 'none';
        postBtn.disabled = false;
    }
}

function postTweet() {
    if (!currentComposerItem) return;
    
    const tweetTextArea = document.getElementById('tweetTextArea');
    const tweetText = tweetTextArea.value;
    const link = currentComposerItem.releaseLink || "https://cloud.google.com/bigquery/docs/release-notes";
    
    const intentUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}&url=${encodeURIComponent(link)}`;
    window.open(intentUrl, '_blank');
    
    closeTwitterComposer(null);
    showToast('Redirected to Twitter to publish!', 'success');
}
