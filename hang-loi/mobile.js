// mobile.js - Nâng cấp mobile, quyền tab, pull-to-refresh, ảnh và offline queue
(function () {
    'use strict';

    const MAX_DEFECT_IMAGES = 5;
    const OFFLINE_QUEUE_KEY = 'offline_defects_v2';
    let selectedDefectImages = [];
    let lastUnreadBadgeCount = 0;

    function isMobileViewport() {
        return window.matchMedia('(max-width: 768px)').matches;
    }

    function isTextInputFocused() {
        const el = document.activeElement;
        return !!el && (
            el.matches?.('input, textarea, select, [contenteditable="true"]')
        );
    }

    function isLoginScreenVisible() {
        const loginScreen = document.getElementById('login-screen');
        return !loginScreen || !loginScreen.classList.contains('hidden');
    }

    function syncMobileAuthVisibility() {
        const nav = document.getElementById('mobile-bottom-nav');
        const authenticated = !isLoginScreenVisible();

        document.body.classList.toggle('app-authenticated', authenticated);

        if (!nav) return authenticated;

        nav.classList.toggle('auth-nav-hidden', !authenticated);
        nav.hidden = !authenticated;
        nav.setAttribute('aria-hidden', authenticated ? 'false' : 'true');

        if (!authenticated) {
            nav.style.setProperty('display', 'none', 'important');
            nav.style.setProperty('visibility', 'hidden', 'important');
            nav.style.setProperty('opacity', '0', 'important');
            nav.style.setProperty('pointer-events', 'none', 'important');
            document.documentElement.style.removeProperty('--mobile-nav-measured-height');
            document.documentElement.style.setProperty('--mobile-visual-bottom', '0px');
            return false;
        }

        nav.style.removeProperty('display');
        nav.style.removeProperty('visibility');
        nav.style.removeProperty('opacity');
        nav.style.removeProperty('pointer-events');
        return true;
    }

    function syncMobileViewportMetrics() {
        if (!isMobileViewport()) {
            document.documentElement.style.removeProperty('--mobile-visual-bottom');
            document.body.classList.remove('keyboard-open');
            syncMobileAuthVisibility();
            return;
        }

        if (!syncMobileAuthVisibility()) {
            document.body.classList.remove('keyboard-open');
            return;
        }

        const nav = document.getElementById('mobile-bottom-nav');
        const viewport = window.visualViewport;
        let visualBottom = 0;

        if (viewport) {
            const rawGap = window.innerHeight - viewport.height - viewport.offsetTop;
            visualBottom = Math.max(0, Math.min(160, Math.round(rawGap)));
        }

        const keyboardLikelyOpen = isTextInputFocused() && viewport && viewport.height < window.innerHeight * 0.72;
        document.body.classList.toggle('keyboard-open', !!keyboardLikelyOpen);

        // Khi bàn phím không mở, đẩy HUD lên khỏi thanh công cụ dưới của trình duyệt.
        document.documentElement.style.setProperty(
            '--mobile-visual-bottom',
            `${keyboardLikelyOpen ? 0 : visualBottom}px`
        );

        if (nav) {
            nav.hidden = false;
            nav.setAttribute('aria-hidden', 'false');
            nav.classList.remove('auth-nav-hidden');
            nav.style.removeProperty('display');
            nav.style.removeProperty('visibility');
            nav.style.removeProperty('opacity');
            nav.style.removeProperty('transform');

            requestAnimationFrame(() => {
                const height = Math.ceil(nav.getBoundingClientRect().height || 82);
                document.documentElement.style.setProperty('--mobile-nav-measured-height', `${height}px`);
            });
        }
    }

    function safeCall(fn, fallback) {
        try { return fn(); } catch (e) { return fallback; }
    }

    window.getAllowedTabs = function getAllowedTabs() {
        const role = safeCall(() => currentRole, 'staff') || 'staff';
        const tabs = [];

        // PC và Mobile dùng chung một cấu hình quyền tab.
        if (role === 'admin') tabs.push('dashboard');
        tabs.push('defects', 'history');
        if (role === 'admin' || role === 'po') tabs.push('catalog');
        tabs.push('users');
        if (role === 'admin') tabs.push('logs');

        return tabs;
    };

    function getBlockedTabMessage(tab) {
        if (tab === 'catalog') return 'Bạn không có quyền truy cập danh mục hàng hóa.';
        if (tab === 'users') return 'Bạn không có quyền truy cập quản lý tài khoản.';
        if (tab === 'logs') return 'Chỉ admin mới được xem nhật ký hoạt động.';
        return 'Bạn không có quyền truy cập tab này.';
    }

    function getActiveTab() {
        const activeBodyClass = [...document.body.classList].find(cls => cls.startsWith('active-tab-'));
        return activeBodyClass ? activeBodyClass.replace('active-tab-', '') : (window.getAllowedTabs()[0] || 'defects');
    }

    function updateMobileTabLayout() {
        const nav = document.getElementById('mobile-bottom-nav');
        if (!nav) return;
        if (!syncMobileAuthVisibility()) return;

        const allowed = window.getAllowedTabs();
        const allTabs = ['dashboard', 'defects', 'history', 'catalog', 'users', 'logs'];
        let visibleCount = 0;

        allTabs.forEach(tab => {
            const mobileBtn = document.getElementById(`m-tab-${tab}`);
            const sideBtn = document.getElementById(`side-tab-${tab}`);
            const topBtn = document.getElementById(`tab-${tab}`);
            const visible = allowed.includes(tab);

            if (mobileBtn) {
                mobileBtn.classList.toggle('mobile-tab-hidden', !visible);
                mobileBtn.classList.toggle('hidden', !visible);
                mobileBtn.hidden = !visible;
                mobileBtn.setAttribute('aria-hidden', visible ? 'false' : 'true');

                // Ép đồng bộ display để không bị class quyền cũ giữ lại sau khi khôi phục phiên.
                if (visible) {
                    mobileBtn.style.removeProperty('display');
                    mobileBtn.style.setProperty('display', 'flex', 'important');
                    visibleCount += 1;
                } else {
                    mobileBtn.style.setProperty('display', 'none', 'important');
                }
            }

            [sideBtn, topBtn].forEach(button => {
                if (!button) return;
                button.classList.toggle('hidden', !visible);
                button.hidden = !visible;
                if (!visible) button.style.setProperty('display', 'none', 'important');
                else button.style.removeProperty('display');
                button.setAttribute('aria-hidden', visible ? 'false' : 'true');
            });
        });

        // Dựa trên số nút thật sự đang hiển thị, tránh trường hợp grid 3 cột rồi mới đổi thành 4.
        const count = Math.max(visibleCount, 1);
        nav.style.setProperty('--mobile-tab-count', String(count));
        nav.dataset.tabCount = String(count);
        nav.classList.add('mobile-nav-ready');
        syncMobileViewportMetrics();
    }

    let mobileNavSyncQueued = false;
    let mobileNavFollowupTimer = null;

    function scheduleMobileTabLayoutSync() {
        if (!isMobileViewport()) {
            document.documentElement.style.removeProperty('--mobile-visual-bottom');
            document.documentElement.style.removeProperty('--mobile-nav-measured-height');
            document.body.classList.remove('keyboard-open');
            syncMobileAuthVisibility();
            return;
        }
        if (mobileNavSyncQueued) return;
        mobileNavSyncQueued = true;
        requestAnimationFrame(() => {
            mobileNavSyncQueued = false;
            syncMobileViewportMetrics();
            updateMobileTabLayout();
        });
        clearTimeout(mobileNavFollowupTimer);
        mobileNavFollowupTimer = setTimeout(() => {
            syncMobileViewportMetrics();
            updateMobileTabLayout();
        }, 120);
    }

    window.refreshMobileNavigation = scheduleMobileTabLayoutSync;

    const originalSwitchTab = window.switchTab;
    if (typeof originalSwitchTab === 'function') {
        window.switchTab = function patchedSwitchTab(tab, options = {}) {
            const allowed = window.getAllowedTabs();
            if (!allowed.includes(tab)) {
                if (!options.silent) window.showToast(getBlockedTabMessage(tab));
                tab = safeCall(() => window.getDefaultLandingTab?.(), null) || allowed[0] || 'defects';
            }

            const result = originalSwitchTab.call(this, tab, options);

            // Tất cả tab dùng chung cửa sổ cuộn. Đưa tab vừa mở về đúng đầu trang
            // để Dashboard không bị mở giữa nội dung hoặc lệch so với các tab khác.
            const resetTabScroll = () => {
                try {
                    document.documentElement.scrollLeft = 0;
                    document.body.scrollLeft = 0;
                    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
                } catch (error) {
                    window.scrollTo(0, 0);
                }
                syncMobileViewportMetrics();
                updateMobileTabLayout();
            };

            if (!options.preserveScroll) {
                resetTabScroll();
                requestAnimationFrame(resetTabScroll);
                setTimeout(resetTabScroll, 80);
            } else {
                updateMobileTabLayout();
            }
            return result;
        };
    }

    const originalApplyPermissionUI = window.applyPermissionUI;
    window.applyPermissionUI = function patchedApplyPermissionUI() {
        if (typeof originalApplyPermissionUI === 'function') {
            originalApplyPermissionUI.apply(this, arguments);
        }
        updateMobileTabLayout();
    };

    function setupHeaderHomeShortcut() {
        const header = document.querySelector('header');
        if (!header) return;

        const targets = [
            header.querySelector('h1'),
            header.querySelector('.p-2.bg-blue-600.rounded-lg')
        ].filter(Boolean);

        targets.forEach(el => {
            el.setAttribute('role', 'button');
            el.setAttribute('tabindex', '0');
            el.title = 'Về tab Báo lỗi';
            const goHome = () => {
                const homeTab = safeCall(() => window.getDefaultLandingTab?.(), null) || window.getAllowedTabs()[0] || 'defects';
                if (typeof window.switchTab === 'function') window.switchTab(homeTab, { silent: true });
                if (typeof window.scrollToTop === 'function') window.scrollToTop();
            };
            el.addEventListener('click', goHome);
            el.addEventListener('keydown', e => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    goHome();
                }
            });
        });
    }

    function setupNotificationShake() {
        const badge = document.getElementById('notification-badge');
        if (!badge) return;

        const bellButton = badge.closest('button');
        const readCount = () => {
            if (badge.classList.contains('hidden')) return 0;
            const value = parseInt((badge.textContent || '0').trim(), 10);
            return Number.isFinite(value) ? value : 0;
        };

        lastUnreadBadgeCount = readCount();

        const trigger = () => {
            const count = readCount();
            if (count > lastUnreadBadgeCount && bellButton) {
                bellButton.classList.remove('notification-shake');
                void bellButton.offsetWidth;
                bellButton.classList.add('notification-shake');
                setTimeout(() => bellButton.classList.remove('notification-shake'), 850);
            }
            lastUnreadBadgeCount = count;
        };

        new MutationObserver(trigger).observe(badge, {
            childList: true,
            characterData: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class']
        });
    }

    function mobileEmptyState({ icon = 'fa-box-open', title = 'Chưa có dữ liệu', subtitle = 'Kéo xuống để tải lại dữ liệu.', action = '' } = {}) {
        return `
            <div class="mobile-empty-state">
                <div class="empty-icon"><i class="fas ${icon} text-2xl"></i></div>
                <div class="empty-title">${title}</div>
                <div class="empty-subtitle">${subtitle}</div>
                ${action ? `<div class="empty-action">${action}</div>` : ''}
            </div>
        `;
    }

    function patchEmptyState(renderName, mobileListId, config) {
        const original = window[renderName];
        if (typeof original !== 'function') return;

        window[renderName] = function patchedRender() {
            const result = original.apply(this, arguments);
            const mobileList = document.getElementById(mobileListId);
            if (mobileList && mobileList.children.length === 0) {
                mobileList.innerHTML = mobileEmptyState(config);
            }
            return result;
        };
    }

    function setupEmptyStates() {
        patchEmptyState('renderDashboard', 'defect-mobile-list', {
            icon: 'fa-clipboard-list',
            title: 'Chưa có báo lỗi',
            subtitle: 'Kéo xuống để tải lại hoặc bấm “Báo lỗi mới”.',
            action: '<button type="button" onclick="toggleModal(\'modal-defect\', true)" class="px-4 py-2 rounded-xl bg-blue-600 text-white font-bold">Báo lỗi mới</button>'
        });

        patchEmptyState('renderHistory', 'history-mobile-list', {
            icon: 'fa-clock-rotate-left',
            title: 'Chưa có lịch sử',
            subtitle: 'Các báo lỗi đã hoàn thành sẽ xuất hiện ở đây. Kéo xuống để tải lại.'
        });

        patchEmptyState('renderCatalog', 'catalog-mobile-list', {
            icon: 'fa-boxes-stacked',
            title: 'Chưa có danh mục',
            subtitle: 'Kéo xuống để tải lại hoặc nhập danh mục từ Excel.'
        });

        patchEmptyState('renderUsers', 'users-mobile-list', {
            icon: 'fa-users-gear',
            title: 'Chưa có tài khoản',
            subtitle: 'Kéo xuống để tải lại danh sách tài khoản.'
        });
    }

    function setupSearchClearButtons() {
        ['search-input', 'history-search', 'catalog-search', 'users-search', 'logs-search'].forEach(id => {
            const input = document.getElementById(id);
            if (!input || input.dataset.clearReady === '1') return;

            input.dataset.clearReady = '1';
            input.classList.add('pr-10');

            const parent = input.parentElement;
            if (parent && getComputedStyle(parent).position === 'static') parent.style.position = 'relative';

            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'search-clear-btn hidden';
            btn.innerHTML = '<i class="fas fa-times text-xs"></i>';
            btn.setAttribute('aria-label', 'Xóa tìm kiếm');
            btn.title = 'Xóa tìm kiếm';

            btn.addEventListener('click', () => {
                input.value = '';
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
                input.focus();
                btn.classList.add('hidden');
            });

            input.addEventListener('input', () => {
                btn.classList.toggle('hidden', !input.value);
            });

            parent?.appendChild(btn);
        });
    }

    function ensurePullRefreshIndicator() {
        let indicator = document.getElementById('mobile-pull-refresh-indicator');
        if (indicator) return indicator;

        indicator = document.createElement('div');
        indicator.id = 'mobile-pull-refresh-indicator';
        indicator.innerHTML = '<i class="fas fa-rotate-right"></i><span>Kéo để tải lại</span>';
        document.body.appendChild(indicator);
        return indicator;
    }

    async function refreshActiveTab() {
        const tab = getActiveTab();
        if (typeof syncOfflineDefects === 'function') await syncOfflineDefects(false);

        if (tab === 'dashboard' || tab === 'defects' || tab === 'history') {
            if (typeof fetchDefects === 'function') await fetchDefects();
        } else if (tab === 'catalog') {
            if (typeof fetchCatalog === 'function') await fetchCatalog({ render: true });
        } else if (tab === 'users') {
            if (safeCall(() => currentRole === 'admin', false) && typeof fetchUsers === 'function') await fetchUsers();
            if (typeof updateMobilePersonalAccount === 'function') updateMobilePersonalAccount();
        } else if (tab === 'logs') {
            if (typeof fetchActivityLogs === 'function') await fetchActivityLogs();
        }

        if (typeof fetchNotifications === 'function') await fetchNotifications(false);
    }

    function isPullRefreshInteractiveTarget(target) {
        return !!target.closest(
            'input, textarea, select, button, a, label, [contenteditable="true"], ' +
            '#modal-image, #modal-defect, #modal-catalog, #modal-barcode-scanner, #modal-password-change, .excel-filter-menu'
        );
    }

    function setupPullToRefresh() {
        const indicator = ensurePullRefreshIndicator();
        let startY = 0;
        let pulling = false;
        let distance = 0;
        let refreshing = false;

        document.addEventListener('touchstart', e => {
            if (!isMobileViewport() || e.touches.length !== 1 || refreshing) return;
            if (isPullRefreshInteractiveTarget(e.target)) return;
            startY = e.touches[0].clientY;
            pulling = window.scrollY <= 0 && startY < 120;
            distance = 0;
        }, { passive: true });

        document.addEventListener('touchmove', e => {
            if (!pulling || !isMobileViewport() || e.touches.length !== 1) return;
            distance = Math.max(0, e.touches[0].clientY - startY);
            if (distance <= 0) return;

            e.preventDefault();
            const progress = Math.min(distance, 92);
            indicator.classList.add('show');
            indicator.style.transform = `translate(-50%, ${Math.min(progress - 72, 16)}px)`;
            indicator.querySelector('span').textContent = distance >= 72 ? 'Thả để tải lại' : 'Kéo để tải lại';
        }, { passive: false });

        document.addEventListener('touchend', async () => {
            if (!pulling) return;
            pulling = false;

            if (distance < 72) {
                indicator.classList.remove('show');
                indicator.style.transform = '';
                return;
            }

            refreshing = true;
            indicator.classList.add('show', 'refreshing');
            indicator.querySelector('span').textContent = 'Đang tải lại...';

            try {
                await refreshActiveTab();
                indicator.querySelector('span').textContent = 'Đã cập nhật';
            } catch (error) {
                console.warn('Lỗi pull-to-refresh:', error);
                indicator.querySelector('span').textContent = 'Không tải lại được';
            } finally {
                setTimeout(() => {
                    indicator.classList.remove('show', 'refreshing');
                    indicator.style.transform = '';
                    indicator.querySelector('span').textContent = 'Kéo để tải lại';
                    refreshing = false;
                    distance = 0;
                }, 650);
            }
        }, { passive: true });
    }

    function fileToDataURL(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    function dataURLToFile(dataUrl, filename) {
        const parts = String(dataUrl).split(',');
        const mime = (parts[0].match(/:(.*?);/) || [])[1] || 'image/jpeg';
        const binary = atob(parts[1] || '');
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        return new File([bytes], filename, { type: mime });
    }

    async function compressImageFile(file) {
        if (!window.imageCompression) return file;
        return imageCompression(file, {
            maxSizeMB: 0.8,
            maxWidthOrHeight: 1280,
            useWebWorker: true,
            initialQuality: 0.82
        });
    }

    function setupDefectImagePicker() {
        const input = document.getElementById('f-image');
        const oldPreview = document.getElementById('image-preview');
        if (!input || input.dataset.mobileUpgradeReady === '1') return;

        input.dataset.mobileUpgradeReady = '1';
        input.onchange = null; // tắt preview ảnh cũ dạng ảnh lớn
        input.multiple = true;
        input.required = false;
        oldPreview?.remove();

        // Không dùng giao diện file mặc định vì sau khi copy ảnh vào preview,
        // code cần xóa input.value để lần sau chọn lại cùng ảnh vẫn kích hoạt change.
        // Nếu vẫn để input hiện ra, trình duyệt sẽ báo "No file chosen" dù app đã nhận ảnh.
        input.classList.add('defect-file-real-input');

        let pickerUi = document.getElementById('defect-image-picker-ui');
        if (!pickerUi) {
            pickerUi = document.createElement('div');
            pickerUi.id = 'defect-image-picker-ui';
            pickerUi.className = 'defect-file-picker-ui';
            pickerUi.innerHTML = `
                <label for="f-image" class="defect-file-choose-btn">
                    <i class="fas fa-images"></i>
                    <span>Chọn ảnh</span>
                </label>
                <span id="defect-image-file-status" class="defect-file-status">Chưa chọn ảnh</span>
            `;
            input.insertAdjacentElement('beforebegin', pickerUi);
        }

        const fileStatus = document.getElementById('defect-image-file-status');

        let help = document.getElementById('defect-image-help');
        if (!help) {
            help = document.createElement('div');
            help.id = 'defect-image-help';
            help.className = 'text-xs text-slate-500';
            help.textContent = `Có thể chọn tối đa ${MAX_DEFECT_IMAGES} ảnh.`;
            input.insertAdjacentElement('afterend', help);
        }

        let grid = document.getElementById('defect-image-preview-grid');
        if (!grid) {
            grid = document.createElement('div');
            grid.id = 'defect-image-preview-grid';
            grid.className = 'defect-preview-grid mt-2 hidden';
            help.insertAdjacentElement('afterend', grid);
        }

        function updateFileStatus() {
            if (!fileStatus) return;
            const count = selectedDefectImages.length;
            fileStatus.textContent = count > 0
                ? `Đã chọn ${count}/${MAX_DEFECT_IMAGES} ảnh`
                : 'Chưa chọn ảnh';
            fileStatus.classList.toggle('has-files', count > 0);
        }

        function renderPreviewGrid() {
            grid.classList.toggle('hidden', selectedDefectImages.length === 0);
            updateFileStatus();
            grid.innerHTML = selectedDefectImages.map((item, index) => `
                <div class="defect-preview-item">
                    <img src="${item.previewUrl}" alt="Ảnh lỗi ${index + 1}">
                    <button type="button" class="defect-preview-remove" data-remove-image="${index}" title="Xóa ảnh">
                        <i class="fas fa-times text-xs"></i>
                    </button>
                </div>
            `).join('');

            grid.querySelectorAll('[data-remove-image]').forEach(btn => {
                btn.addEventListener('click', () => {
                    const idx = Number(btn.dataset.removeImage);
                    const [removed] = selectedDefectImages.splice(idx, 1);
                    if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
                    renderPreviewGrid();
                });
            });
        }

        input.addEventListener('change', async e => {
            const files = Array.from(e.target.files || []).filter(file => file.type.startsWith('image/'));
            if (!files.length) {
                updateFileStatus();
                return;
            }

            const room = MAX_DEFECT_IMAGES - selectedDefectImages.length;
            const accepted = files.slice(0, Math.max(0, room));
            if (files.length > room) window.showToast(`Chỉ được chọn tối đa ${MAX_DEFECT_IMAGES} ảnh.`);

            for (const originalFile of accepted) {
                try {
                    const compressedFile = await compressImageFile(originalFile);
                    selectedDefectImages.push({
                        file: compressedFile,
                        originalName: originalFile.name,
                        previewUrl: URL.createObjectURL(compressedFile)
                    });
                } catch (error) {
                    console.warn('Không nén được ảnh, dùng ảnh gốc:', error);
                    selectedDefectImages.push({
                        file: originalFile,
                        originalName: originalFile.name,
                        previewUrl: URL.createObjectURL(originalFile)
                    });
                }
            }

            input.value = '';
            renderPreviewGrid();
        });

        window.resetDefectImagePicker = function resetDefectImagePicker() {
            selectedDefectImages.forEach(item => {
                if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
            });
            selectedDefectImages = [];
            input.value = '';
            renderPreviewGrid();
        };

        renderPreviewGrid();
    }

    async function uploadDefectImages(imageItems) {
        const uploaded = [];
        for (const item of imageItems) {
            const file = item.file || item;
            const ext = (item.originalName || file.name || 'jpg').split('.').pop() || 'jpg';
            const filePath = `defects/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
            const { error: uploadError } = await supabaseClient.storage
                .from('defect-images')
                .upload(filePath, file);
            if (uploadError) throw uploadError;

            const { data: publicUrlData } = supabaseClient.storage
                .from('defect-images')
                .getPublicUrl(filePath);
            uploaded.push({ url: publicUrlData.publicUrl, path: filePath });
        }
        return uploaded;
    }

    async function insertDefectPayload(payload, uploadedImages) {
        const imageUrls = uploadedImages.map(img => img.url);
        const insertPayload = {
            ...payload,
            image_url: imageUrls[0] || null
        };

        if (imageUrls.length > 1) insertPayload.image_urls = imageUrls;

        let result = await supabaseClient
            .from('defects')
            .insert([insertPayload])
            .select()
            .single();

        if (result.error && insertPayload.image_urls && /image_urls|column|schema/i.test(result.error.message || '')) {
            // Tương thích database cũ: nếu chưa thêm cột image_urls thì lưu toàn bộ ảnh vào cột image_url dạng JSON.
            // app.js đã được cập nhật để đọc được cả image_url dạng URL đơn và dạng JSON array.
            insertPayload.image_url = JSON.stringify(imageUrls);
            delete insertPayload.image_urls;
            result = await supabaseClient
                .from('defects')
                .insert([insertPayload])
                .select()
                .single();
        }

        if (result.error) throw result.error;
        return result.data;
    }

    function getOfflineQueue() {
        try { return JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]'); }
        catch (e) { return []; }
    }

    function setOfflineQueue(queue) {
        localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    }

    async function saveOfflineDefect(payload, imageItems) {
        const queue = getOfflineQueue();
        const images = [];
        for (const item of imageItems) {
            images.push({
                name: item.originalName || item.file?.name || `defect_${Date.now()}.jpg`,
                dataUrl: await fileToDataURL(item.file || item)
            });
        }
        queue.push({
            id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
            createdAt: new Date().toISOString(),
            payload,
            images
        });
        setOfflineQueue(queue);
    }

    window.syncOfflineDefects = async function syncOfflineDefects(showAlert = false) {
        if (!navigator.onLine || !window.supabaseClient) return;
        const queue = getOfflineQueue();
        if (!queue.length) return;

        const remaining = [];
        let synced = 0;

        for (const item of queue) {
            try {
                const imageItems = (item.images || []).map((img, index) => ({
                    file: dataURLToFile(img.dataUrl, img.name || `offline_${index}.jpg`),
                    originalName: img.name || `offline_${index}.jpg`
                }));
                const uploaded = await uploadDefectImages(imageItems);
                const inserted = await insertDefectPayload(item.payload, uploaded);
                if (typeof createNotification === 'function') await createNotification('defect_created', inserted || item.payload);
                if (typeof createActivityLog === 'function') {
                    await createActivityLog('create', 'defects', (inserted || item.payload).id, `Đồng bộ báo lỗi offline: ${(inserted || item.payload).product_name || '-'}`, {
                        sku: (inserted || item.payload).sku,
                        barcode: (inserted || item.payload).barcode
                    });
                }
                synced++;
            } catch (error) {
                console.warn('Chưa đồng bộ được báo lỗi offline:', error);
                remaining.push(item);
            }
        }

        setOfflineQueue(remaining);
        if (synced && typeof fetchDefects === 'function') await fetchDefects();
        if (synced && showAlert) window.showToast(`Đã đồng bộ ${synced} báo lỗi lưu tạm.`);
    };

    function setupEnhancedDefectSubmit() {
        const form = document.getElementById('defect-form');
        if (!form || form.dataset.enhancedSubmitReady === '1') return;
        form.dataset.enhancedSubmitReady = '1';

        form.onsubmit = async e => {
            e.preventDefault();
            const submitBtn = form.querySelector('button[type="submit"]');
            const defectTypeInput = form.querySelector('[name="defect_type"]');
            const defectType = safeCall(() => cleanTextValue(defectTypeInput?.value), defectTypeInput?.value?.trim() || '');

            if (!defectType) {
                window.showToast('Vui lòng nhập Mô tả lỗi trước khi lưu báo cáo.');
                defectTypeInput?.focus();
                return;
            }

            if (!selectedDefectImages.length) {
                window.showToast('Vui lòng chọn ít nhất 1 hình ảnh sản phẩm lỗi trước khi lưu báo cáo.');
                document.getElementById('f-image')?.focus();
                return;
            }

            const formData = Object.fromEntries(new FormData(form));
            const supplier = safeCall(() => normalizeSupplierFields(formData), {
                vendor_name: formData.vendor_name || '',
                vendor_id: formData.vendor_id || ''
            });

            const payload = {
                barcode: safeCall(() => cleanTextValue(formData.barcode || document.getElementById('auto-barcode')?.value), formData.barcode || ''),
                product_name: safeCall(() => cleanTextValue(formData.product_name), formData.product_name || ''),
                sku: safeCall(() => cleanTextValue(formData.sku), formData.sku || ''),
                vendor_name: supplier.vendor_name,
                vendor_id: supplier.vendor_id,
                defect_type: defectType,
                quantity: Number(formData.quantity || 1),
                severity: safeCall(() => cleanTextValue(formData.severity || 'Medium'), formData.severity || 'Medium'),
                status: safeCall(() => cleanTextValue(formData.status || 'Pending'), formData.status || 'Pending')
            };

            try {
                if (submitBtn) {
                    submitBtn.disabled = true;
                    submitBtn.innerText = navigator.onLine ? 'Đang lưu báo cáo...' : 'Đang lưu tạm...';
                }

                if (!navigator.onLine || !window.supabaseClient) {
                    await saveOfflineDefect(payload, selectedDefectImages);
                    window.showToast('Đang mất mạng. Báo lỗi đã được lưu tạm trên máy và sẽ tự đồng bộ khi có mạng.');
                } else {
                    if (typeof showAppLoading === 'function') showAppLoading('Đang lưu báo cáo lỗi...', 'Đang nén ảnh và gửi dữ liệu lên Supabase');
                    const uploadedImages = await uploadDefectImages(selectedDefectImages);
                    const insertedDefect = await insertDefectPayload(payload, uploadedImages);
                    if (typeof createNotification === 'function') await createNotification('defect_created', insertedDefect || payload);
                    if (typeof createActivityLog === 'function') {
                        await createActivityLog('create', 'defects', (insertedDefect || payload).id, `Thêm báo lỗi mới: ${(insertedDefect || payload).product_name || '-'}`, {
                            sku: (insertedDefect || payload).sku,
                            barcode: (insertedDefect || payload).barcode,
                            vendor_id: (insertedDefect || payload).vendor_id,
                            quantity: (insertedDefect || payload).quantity,
                            status: (insertedDefect || payload).status
                        });
                    }
                    if (typeof fetchDefects === 'function') await fetchDefects();
                    window.showToast('Đã lưu báo cáo thành công!');
                }

                if (typeof toggleModal === 'function') toggleModal('modal-defect', false);
                form.reset();
                if (typeof window.resetDefectImagePicker === 'function') window.resetDefectImagePicker();
            } catch (error) {
                console.warn('Lỗi lưu online, thử lưu tạm offline:', error);
                try {
                    await saveOfflineDefect(payload, selectedDefectImages);
                    window.showToast('Chưa gửi được lên Supabase. Báo lỗi đã được lưu tạm và sẽ đồng bộ lại khi có mạng.');
                    if (typeof toggleModal === 'function') toggleModal('modal-defect', false);
                    form.reset();
                    if (typeof window.resetDefectImagePicker === 'function') window.resetDefectImagePicker();
                } catch (offlineError) {
                    window.showToast('Lỗi: ' + (error?.message || offlineError?.message || 'Không lưu được báo lỗi'));
                }
            } finally {
                if (typeof hideAppLoading === 'function') hideAppLoading(true);
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerText = 'Lưu báo cáo';
                }
            }
        };
    }


    function setupAutoHideHeaderOnScroll() {
        if (document.documentElement.dataset.mobileHeaderScrollReady === '1') return;
        document.documentElement.dataset.mobileHeaderScrollReady = '1';

        let lastScrollY = Math.max(0, window.scrollY || 0);
        let scrollDirection = '';
        let directionDistance = 0;
        let framePending = false;

        const showHeader = () => document.body.classList.remove('mobile-header-hidden');
        const hideHeader = () => document.body.classList.add('mobile-header-hidden');

        const shouldPause = () => {
            if (!isMobileViewport()) return true;
            if (!document.body.classList.contains('app-authenticated')) return true;
            if (document.body.classList.contains('modal-open')) return true;
            if (document.body.classList.contains('keyboard-open')) return true;
            return false;
        };

        const updateHeaderVisibility = () => {
            framePending = false;
            const currentScrollY = Math.max(0, window.scrollY || document.documentElement.scrollTop || 0);

            if (!isMobileViewport()) {
                showHeader();
                lastScrollY = currentScrollY;
                scrollDirection = '';
                directionDistance = 0;
                return;
            }

            // Ở đầu trang luôn hiện header để người dùng không bị mất định hướng.
            if (currentScrollY <= 16) {
                showHeader();
                lastScrollY = currentScrollY;
                scrollDirection = '';
                directionDistance = 0;
                return;
            }

            if (shouldPause()) {
                lastScrollY = currentScrollY;
                scrollDirection = '';
                directionDistance = 0;
                return;
            }

            const delta = currentScrollY - lastScrollY;
            if (Math.abs(delta) < 1) return;

            const nextDirection = delta > 0 ? 'down' : 'up';
            if (nextDirection !== scrollDirection) {
                scrollDirection = nextDirection;
                directionDistance = Math.abs(delta);
            } else {
                directionDistance += Math.abs(delta);
            }

            // Vuốt nội dung lên (scrollY tăng): ẩn header.
            if (scrollDirection === 'down' && currentScrollY > 72 && directionDistance >= 18) {
                hideHeader();
                directionDistance = 0;
            }

            // Vuốt nội dung xuống (scrollY giảm): hiện lại header nhanh hơn.
            if (scrollDirection === 'up' && directionDistance >= 10) {
                showHeader();
                directionDistance = 0;
            }

            lastScrollY = currentScrollY;
        };

        const scheduleUpdate = () => {
            if (framePending) return;
            framePending = true;
            window.requestAnimationFrame(updateHeaderVisibility);
        };

        window.addEventListener('scroll', scheduleUpdate, { passive: true });
        window.addEventListener('resize', () => {
            if (!isMobileViewport()) showHeader();
            scheduleUpdate();
        }, { passive: true });
        window.addEventListener('orientationchange', () => {
            showHeader();
            lastScrollY = Math.max(0, window.scrollY || 0);
        }, { passive: true });

        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                lastScrollY = Math.max(0, window.scrollY || 0);
                if (lastScrollY <= 16) showHeader();
            }
        });
    }

    function bootMobileEnhancements() {
        const mobile = isMobileViewport();
        const nav = document.getElementById('mobile-bottom-nav');

        if (mobile) {
            if (nav && nav.parentElement !== document.body) document.body.appendChild(nav);
            scheduleMobileTabLayoutSync();
            setupHeaderHomeShortcut();
            setupPullToRefresh();
            setupAutoHideHeaderOnScroll();
        }

        setupNotificationShake();
        setupEmptyStates();
        setupSearchClearButtons();
        setupDefectImagePicker();
        setupEnhancedDefectSubmit();

        // Không gọi render hàng loạt khi app vừa mở. Dữ liệu sẽ được dựng
        // theo đúng tab sau khi phiên đăng nhập đã sẵn sàng.
    }

    window.addEventListener('online', () => {
        window.syncOfflineDefects(true).catch(error => console.warn('Lỗi đồng bộ offline:', error));
    });
    window.addEventListener('resize', scheduleMobileTabLayoutSync, { passive: true });
    window.addEventListener('orientationchange', scheduleMobileTabLayoutSync, { passive: true });
    window.addEventListener('pageshow', scheduleMobileTabLayoutSync, { passive: true });
    window.addEventListener('load', scheduleMobileTabLayoutSync, { passive: true });
    window.addEventListener('focusin', scheduleMobileTabLayoutSync, { passive: true });
    window.addEventListener('focusout', scheduleMobileTabLayoutSync, { passive: true });
    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', scheduleMobileTabLayoutSync, { passive: true });
        window.visualViewport.addEventListener('scroll', syncMobileViewportMetrics, { passive: true });
    }
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) scheduleMobileTabLayoutSync();
    });

    // Khi login-screen đóng hoặc role trên body đổi, dựng lại thanh tab ngay lập tức.
    const navStateObserver = new MutationObserver(() => {
        if (isMobileViewport()) scheduleMobileTabLayoutSync();
    });
    const loginScreen = document.getElementById('login-screen');
    if (loginScreen) navStateObserver.observe(loginScreen, { attributes: true, attributeFilter: ['class'] });
    navStateObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bootMobileEnhancements);
    } else {
        bootMobileEnhancements();
    }
})();
