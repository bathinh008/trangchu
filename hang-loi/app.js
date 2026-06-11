let defectsData = [];
        let catalogData = [];
		
		let currentUser = null;
		let currentRole = 'staff';
		let currentDisplayName = 'Người dùng';
		let notificationsData = [];
		let notificationChannelReady = false;
		let notificationChannel = null;
		let activityLogsData = [];
		let activityLogChannelReady = false;

        const defectList = document.getElementById('defect-list');
		const historyList = document.getElementById('history-list');
		const catalogList = document.getElementById('catalog-list');
		const catalogMobileList = document.getElementById('catalog-mobile-list');
		const searchInput = document.getElementById('search-input');
		const usersList = document.getElementById('users-list');
		const usersMobileList = document.getElementById('users-mobile-list');
		const catalogSearch = document.getElementById('catalog-search');
		const historySearch = document.getElementById('history-search');
		const usersSearch = document.getElementById('users-search');
		const logsSearch = document.getElementById('logs-search');
		
		let appUsers = [];
		let notificationPollingTimer = null;
		let dataPollingTimer = null;

        let appLoadingCount = 0;

        function showAppLoading(title = 'Đang tải dữ liệu...', subtitle = 'Vui lòng chờ trong giây lát') {
            appLoadingCount++;
            const overlay = document.getElementById('app-loading-overlay');
            const titleEl = document.getElementById('app-loading-title');
            const subtitleEl = document.getElementById('app-loading-subtitle');

            if (titleEl) titleEl.innerText = title;
            if (subtitleEl) subtitleEl.innerText = subtitle;
            if (overlay) overlay.classList.add('show');
        }

        function updateAppLoading(title, subtitle) {
            const titleEl = document.getElementById('app-loading-title');
            const subtitleEl = document.getElementById('app-loading-subtitle');
            if (titleEl && title) titleEl.innerText = title;
            if (subtitleEl && subtitle) subtitleEl.innerText = subtitle;
        }

        function hideAppLoading(force = false) {
            if (force) appLoadingCount = 0;
            else appLoadingCount = Math.max(0, appLoadingCount - 1);

            if (appLoadingCount === 0) {
                const overlay = document.getElementById('app-loading-overlay');
                if (overlay) overlay.classList.remove('show');
            }
        }

        async function withAppLoading(title, subtitle, task) {
            showAppLoading(title, subtitle);
            try {
                return await task();
            } finally {
                hideAppLoading();
            }
        }

        function setButtonLoading(button, isLoading, text) {
            if (!button) return;
            if (isLoading) {
                button.dataset.oldText = button.innerText;
                button.disabled = true;
                button.innerText = text || 'Đang xử lý';
                button.classList.add('btn-loading');
            } else {
                button.disabled = false;
                button.innerText = button.dataset.oldText || button.innerText;
                button.classList.remove('btn-loading');
            }
        }


        function getToastTypeFromMessage(message) {
            const text = String(message || '').toLowerCase();
            if (text.includes('thành công') || text.startsWith('đã ') || text.includes('đã lưu') || text.includes('đã xóa') || text.includes('đã nhập') || text.includes('đã tạo') || text.includes('đã đồng bộ')) {
                return 'success';
            }
            if (text.includes('lỗi') || text.includes('không tìm thấy') || text.includes('không có dữ liệu') || text.includes('không lưu được') || text.includes('chưa gửi được')) {
                return 'error';
            }
            if (text.includes('vui lòng') || text.includes('chưa') || text.includes('chỉ ') || text.includes('không có quyền') || text.includes('cần chạy') || text.includes('tối đa')) {
                return 'warning';
            }
            return 'info';
        }

        function showToast(message, type, options = {}) {
            const text = String(message || '').trim();
            if (!text) return;

            const toastType = type || getToastTypeFromMessage(text);
            const duration = Number(options.duration || 3800);
            let container = document.getElementById('notification-toast-container');

            if (!container) {
                container = document.createElement('div');
                container.id = 'notification-toast-container';
                container.className = 'fixed top-20 right-4 left-4 md:left-auto z-[9999] space-y-3 pointer-events-none';
                document.body.appendChild(container);
            }

            const iconMap = {
                success: 'fa-circle-check',
                error: 'fa-circle-exclamation',
                warning: 'fa-triangle-exclamation',
                info: 'fa-circle-info'
            };

            const toast = document.createElement('div');
            toast.className = `app-toast app-toast-${toastType}`;
            toast.setAttribute('role', 'status');
            toast.setAttribute('aria-live', 'polite');

            const icon = document.createElement('i');
            icon.className = `fas ${iconMap[toastType] || iconMap.info} app-toast-icon`;

            const content = document.createElement('div');
            content.className = 'app-toast-message';
            content.textContent = text;

            const closeBtn = document.createElement('button');
            closeBtn.type = 'button';
            closeBtn.className = 'app-toast-close';
            closeBtn.setAttribute('aria-label', 'Đóng thông báo');
            closeBtn.innerHTML = '<i class="fas fa-times"></i>';

            toast.appendChild(icon);
            toast.appendChild(content);
            toast.appendChild(closeBtn);
            container.appendChild(toast);

            requestAnimationFrame(() => toast.classList.add('show'));

            const removeToast = () => {
                toast.classList.remove('show');
                toast.classList.add('hide');
                setTimeout(() => toast.remove(), 220);
            };

            closeBtn.addEventListener('click', (event) => {
                event.stopPropagation();
                removeToast();
            });

            if (duration > 0) setTimeout(removeToast, duration);
        }

        window.showToast = showToast;

        function getConfirmTypeFromMessage(message) {
            const text = String(message || '').toLowerCase();
            if (text.includes('xóa') || text.includes('không thể hoàn tác') || text.includes('xác nhận lần cuối')) return 'danger';
            if (text.includes('cảnh báo') || text.includes('chắc chắn')) return 'warning';
            return 'info';
        }

        function showConfirm(message, options = {}) {
            const text = String(message || '').trim();
            if (!text) return Promise.resolve(false);

            const confirmType = options.type || getConfirmTypeFromMessage(text);
            const title = options.title || (confirmType === 'danger' ? 'Xác nhận xóa dữ liệu' : 'Xác nhận thao tác');
            const confirmText = options.confirmText || (confirmType === 'danger' ? 'Xóa' : 'Xác nhận');
            const cancelText = options.cancelText || 'Hủy';
            const iconMap = {
                danger: 'fa-trash-can',
                warning: 'fa-triangle-exclamation',
                info: 'fa-circle-question'
            };

            return new Promise((resolve) => {
                const overlay = document.createElement('div');
                overlay.className = 'app-confirm-overlay';

                const dialog = document.createElement('div');
                dialog.className = `app-confirm-dialog app-confirm-${confirmType}`;
                dialog.setAttribute('role', 'dialog');
                dialog.setAttribute('aria-modal', 'true');
                dialog.setAttribute('aria-labelledby', 'app-confirm-title');
                dialog.setAttribute('aria-describedby', 'app-confirm-message');

                const head = document.createElement('div');
                head.className = 'app-confirm-head';

                const iconWrap = document.createElement('div');
                iconWrap.className = 'app-confirm-icon';
                iconWrap.innerHTML = `<i class="fas ${iconMap[confirmType] || iconMap.info}"></i>`;

                const titleEl = document.createElement('div');
                titleEl.id = 'app-confirm-title';
                titleEl.className = 'app-confirm-title';
                titleEl.textContent = title;

                head.appendChild(iconWrap);
                head.appendChild(titleEl);

                const messageEl = document.createElement('div');
                messageEl.id = 'app-confirm-message';
                messageEl.className = 'app-confirm-message';
                messageEl.textContent = text;

                const actions = document.createElement('div');
                actions.className = 'app-confirm-actions';

                const cancelBtn = document.createElement('button');
                cancelBtn.type = 'button';
                cancelBtn.className = 'app-confirm-btn app-confirm-cancel';
                cancelBtn.textContent = cancelText;

                const confirmBtn = document.createElement('button');
                confirmBtn.type = 'button';
                confirmBtn.className = `app-confirm-btn app-confirm-ok app-confirm-ok-${confirmType}`;
                confirmBtn.textContent = confirmText;

                actions.appendChild(cancelBtn);
                actions.appendChild(confirmBtn);
                dialog.appendChild(head);
                dialog.appendChild(messageEl);
                dialog.appendChild(actions);
                overlay.appendChild(dialog);
                document.body.appendChild(overlay);

                const close = (result) => {
                    overlay.classList.remove('show');
                    dialog.classList.remove('show');
                    document.removeEventListener('keydown', onKeyDown);
                    setTimeout(() => overlay.remove(), 180);
                    resolve(result);
                };

                const onKeyDown = (event) => {
                    if (event.key === 'Escape') close(false);
                    if (event.key === 'Enter') close(true);
                };

                cancelBtn.addEventListener('click', () => close(false));
                confirmBtn.addEventListener('click', () => close(true));
                overlay.addEventListener('click', (event) => {
                    if (event.target === overlay) close(false);
                });
                document.addEventListener('keydown', onKeyDown);

                requestAnimationFrame(() => {
                    overlay.classList.add('show');
                    dialog.classList.add('show');
                    cancelBtn.focus();
                });
            });
        }

        window.showConfirm = showConfirm;


		async function fetchUsers() {

			if (!isAdmin()) return;

			const { data, error } = await supabaseClient
				.from('app_users')
				.select('*')
				.order('created_at', { ascending: false });

			if (!error) {
				appUsers = data || [];
				renderUsers();
			}
		}

		async function deleteAllDefects() {
			if (!isAdmin()) {
				window.showToast("Chỉ admin mới được xóa tất cả.");
				return;
			}

			if (!(await showConfirm("Bạn chắc chắn muốn xóa TẤT CẢ báo cáo lỗi?", { title: "Xóa tất cả báo cáo lỗi", confirmText: "Tiếp tục" }))) return;
			if (!(await showConfirm("Thao tác này không thể hoàn tác. Xác nhận lần cuối?", { title: "Xác nhận lần cuối", confirmText: "Xóa tất cả" }))) return;

			try {
				const imagePaths = [...new Set(
					defectsData
						.flatMap(d => getDefectImageUrls(d).map(getDefectStoragePath))
						.filter(Boolean)
				)];

				if (imagePaths.length > 0) {
					await supabaseClient.storage
						.from('defect-images')
						.remove(imagePaths);
				}

				const { error } = await supabaseClient
					.from('defects')
					.delete()
					.neq('id', '00000000-0000-0000-0000-000000000000');

				if (error) throw error;

				await createActivityLog('delete', 'defects', null, 'Xóa tất cả báo cáo lỗi', { count: defectsData.length });

				window.showToast("Đã xóa tất cả báo cáo lỗi.");
				await fetchDefects();

			} catch (error) {
				window.showToast("Lỗi khi xóa tất cả: " + error.message);
			}
		}

		async function toggleUserStatus(id, currentStatus) {

			const { error } = await supabaseClient
				.from('app_users')
				.update({
					active: !currentStatus
				})
				.eq('id', id);

			if (!error) {
				await createActivityLog('update', 'app_users', id, 'Đổi trạng thái tài khoản', { active: !currentStatus });
				fetchUsers();
			}
		}

		async function deleteUser(id) {

			if (!(await showConfirm('Xác nhận xóa tài khoản?', { title: 'Xóa tài khoản', confirmText: 'Xóa' }))) return;

			const { error } = await supabaseClient
				.from('app_users')
				.delete()
				.eq('id', id);

			if (!error) {
				await createActivityLog('delete', 'app_users', id, 'Xóa tài khoản nội bộ', { id });
				fetchUsers();
			}
		}
		
        async function init() {
			if (!supabaseClient) {
				updateStatusUI('offline');
				return;
			}
			updateStatusUI('connecting');
			showAppLoading('Đang kết nối hệ thống...', 'Đang tải báo cáo lỗi và danh mục');
			
			try {
				// Chỉ tải dữ liệu công khai ban đầu. Thông báo sẽ tải sau khi đăng nhập xong
				// để tránh Auth/Anon bị lệch quyền và tránh lỗi WebSocket.
				await Promise.all([fetchDefects(), fetchCatalog()]);
				updateStatusUI('online');
			} finally {
				hideAppLoading(true);
			}
		}

        async function fetchDefects() {
            const { data, error } = await supabaseClient.from('defects').select('*').order('created_at', { ascending: false });
            if (!error) { 
				defectsData = data || []; 
				renderDashboard();
				renderHistory();
				updateStats();
			}
        }

        async function fetchCatalog() {
            const { data, error } = await supabaseClient.from('catalog').select('*');
            if (!error) { catalogData = data || []; renderCatalog(); }
        }

        function getCurrentAccountKey() {
            if (!currentUser) return 'guest';

            return String(
                currentUser.username ||
                currentUser.email ||
                currentUser.id ||
                'guest'
            ).toLowerCase();
        }

        function getNotificationReadKey() {
            return `notification_read_${getCurrentAccountKey()}`;
        }

        function getReadNotificationIds() {
            try {
                return JSON.parse(localStorage.getItem(getNotificationReadKey()) || '[]');
            } catch (e) {
                return [];
            }
        }

        function setReadNotificationIds(ids) {
            localStorage.setItem(
                getNotificationReadKey(),
                JSON.stringify([...new Set(ids)])
            );
        }

        const PWA_BADGE_MAX_COUNT = 99;

        function normalizePwaBadgeCount(count) {
            const value = Number(count);
            if (!Number.isFinite(value) || value <= 0) return 0;
            return Math.min(Math.floor(value), PWA_BADGE_MAX_COUNT);
        }

        function syncPwaBadgeToServiceWorker(count) {
            if (!('serviceWorker' in navigator)) return;

            const badgeCount = normalizePwaBadgeCount(count);

            navigator.serviceWorker.ready
                .then(registration => {
                    if (registration?.active) {
                        registration.active.postMessage({
                            type: 'PWA_BADGE_SET',
                            count: badgeCount
                        });
                    }
                })
                .catch(() => null);
        }

        async function updatePwaAppBadge(count) {
            const badgeCount = normalizePwaBadgeCount(count);

            syncPwaBadgeToServiceWorker(badgeCount);

            try {
                if (!('setAppBadge' in navigator) || !('clearAppBadge' in navigator)) return;

                if (badgeCount > 0) {
                    await navigator.setAppBadge(badgeCount);
                } else {
                    await navigator.clearAppBadge();
                }
            } catch (error) {
                console.warn('Không cập nhật được số đếm PWA:', error?.message || error);
            }
        }

        function clearPwaAppBadge() {
            updatePwaAppBadge(0);
        }

        function isNotificationRead(id) {
            return getReadNotificationIds().includes(String(id));
        }

        function getNotificationSeenKey() {
            return `notification_seen_${getCurrentAccountKey()}`;
        }

        function getSeenNotificationIds() {
            try {
                return JSON.parse(localStorage.getItem(getNotificationSeenKey()) || '[]');
            } catch (e) {
                return [];
            }
        }

        function setSeenNotificationIds(ids) {
            localStorage.setItem(
                getNotificationSeenKey(),
                JSON.stringify([...new Set(ids.map(String))])
            );
        }

        function urlBase64ToUint8Array(base64String) {
            const padding = '='.repeat((4 - base64String.length % 4) % 4);
            const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
            const rawData = window.atob(base64);
            const outputArray = new Uint8Array(rawData.length);
            for (let i = 0; i < rawData.length; ++i) {
                outputArray[i] = rawData.charCodeAt(i);
            }
            return outputArray;
        }

        function isPushConfigured() {
            return !!VAPID_PUBLIC_KEY && !VAPID_PUBLIC_KEY.includes('THAY_');
        }

        async function getServiceWorkerRegistration() {
            if (!('serviceWorker' in navigator)) {
                throw new Error('Trình duyệt này chưa hỗ trợ Service Worker.');
            }
            return await navigator.serviceWorker.register('../service-worker.js');
        }

        async function savePushSubscription(subscription) {
            if (!subscription || !supabaseClient || !currentUser) return;

            const json = subscription.toJSON();
            const accountKey = getCurrentAccountKey();

            const payload = {
                endpoint: json.endpoint,
                p256dh: json.keys?.p256dh || '',
                auth: json.keys?.auth || '',
                user_key: accountKey,
                username: currentUser.username || currentUser.email || currentUser.id || '',
                display_name: currentDisplayName || '',
                user_role: currentRole || 'staff',
                user_agent: navigator.userAgent || '',
                active: true,
                updated_at: new Date().toISOString()
            };

            const { error } = await supabaseClient
                .from('push_subscriptions')
                .upsert(payload, { onConflict: 'endpoint' });

            if (error) throw error;
        }

        async function syncExistingPushSubscription() {
            try {
                if (!isPushConfigured() || Notification.permission !== 'granted') return;
                const registration = await getServiceWorkerRegistration();
                const existing = await registration.pushManager.getSubscription();
                if (existing) await savePushSubscription(existing);
                updatePushStatusUI();
            } catch (error) {
                console.warn('Không đồng bộ được push subscription:', error.message);
            }
        }

        async function enablePhonePushNotifications() {
            try {
                if (!window.isSecureContext) {
                    window.showToast('Web Push cần chạy bằng HTTPS hoặc localhost. Hãy upload web lên hosting HTTPS trước.');
                    return;
                }

                if (!('Notification' in window) || !('PushManager' in window)) {
                    window.showToast('Trình duyệt này chưa hỗ trợ Web Push Notification. Nên dùng Chrome/Edge Android hoặc PWA trên iOS 16.4+.');
                    return;
                }

                if (!isPushConfigured()) {
                    window.showToast('Bạn chưa điền VAPID_PUBLIC_KEY trong file hang-loi/index.html. Hãy tạo khóa VAPID rồi thay vào trước.');
                    return;
                }

                const permission = await Notification.requestPermission();
                if (permission !== 'granted') {
                    updatePushStatusUI();
                    window.showToast('Bạn chưa cấp quyền thông báo cho web/app.');
                    return;
                }

                const registration = await getServiceWorkerRegistration();
                let subscription = await registration.pushManager.getSubscription();

                if (!subscription) {
                    subscription = await registration.pushManager.subscribe({
                        userVisibleOnly: true,
                        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
                    });
                }

                await savePushSubscription(subscription);
                updatePushStatusUI('Đã bật thông báo điện thoại cho thiết bị này');

                registration.showNotification('Đã bật thông báo', {
                    body: 'Thiết bị này sẽ nhận thông báo khi có hàng lỗi mới.',
                    icon: new URL('../icons/icon-192.png', window.location.href).href,
                    badge: new URL('../icons/icon-192.png', window.location.href).href,
                    data: { url: 'hang-loi/' }
                });
            } catch (error) {
                console.warn('Lỗi bật Web Push:', error);
                updatePushStatusUI('Lỗi bật thông báo: ' + error.message);
                window.showToast('Lỗi bật thông báo: ' + error.message);
            }
        }

        function updatePushStatusUI(customText) {
            const statusEl = document.getElementById('push-status-text');
            const btn = document.getElementById('enable-push-btn');
            if (!statusEl || !btn) return;

            if (!('Notification' in window) || !('PushManager' in window)) {
                statusEl.innerText = 'Thiết bị/trình duyệt chưa hỗ trợ Web Push';
                btn.disabled = true;
                btn.classList.add('opacity-60');
                return;
            }

            if (customText) {
                statusEl.innerText = customText;
                return;
            }

            if (!isPushConfigured()) {
                statusEl.innerText = 'Chưa cấu hình VAPID key';
                return;
            }

            if (Notification.permission === 'granted') {
                statusEl.innerText = 'Đã cấp quyền thông báo';
                btn.innerText = 'Bật lại';
            } else if (Notification.permission === 'denied') {
                statusEl.innerText = 'Đang bị chặn thông báo trong trình duyệt';
            } else {
                statusEl.innerText = 'Chưa bật thông báo trên thiết bị này';
            }
        }

        async function sendWebPushForNotification(notification) {
            // Gửi Web Push cho mọi thông báo hàng lỗi, không chỉ thông báo tạo mới.
            // Trước đây hàm này chặn tất cả type khác defect_created nên đổi trạng thái Đang sửa/Xong
            // chỉ hiện trong chuông trong app, không đẩy lên thanh trạng thái điện thoại.
            if (!notification) return;

            const allowedTypes = [
                'defect_created',
                'defect_fixing',
                'defect_resolved',
                'defect_status_updated'
            ];

            if (!allowedTypes.includes(notification.type)) return;

            try {
                const { error } = await supabaseClient.functions.invoke('send-push', {
                    body: {
                        notification_id: notification.id,
                        title: notification.title || 'Có cập nhật hàng lỗi',
                        body: notification.message || `${notification.product_name || 'Sản phẩm'} vừa được cập nhật`,
                        url: 'hang-loi/',
                        type: notification.type,
                        product_name: notification.product_name || '',
                        sku: notification.sku || '',
                        barcode: notification.barcode || '',
                        defect_id: notification.defect_id || null,
                        status: notification.status || null
                    }
                });

                if (error) console.warn('Chưa gửi được Web Push:', error.message);
            } catch (error) {
                console.warn('Edge Function send-push chưa sẵn sàng hoặc bị lỗi:', error.message);
            }
        }

        function playNotificationBeep() {
            try {
                const AudioCtx = window.AudioContext || window.webkitAudioContext;
                if (!AudioCtx) return;

                const ctx = new AudioCtx();
                const oscillator = ctx.createOscillator();
                const gain = ctx.createGain();

                oscillator.type = 'sine';
                oscillator.frequency.setValueAtTime(880, ctx.currentTime);
                gain.gain.setValueAtTime(0.0001, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.02);
                gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.22);

                oscillator.connect(gain);
                gain.connect(ctx.destination);
                oscillator.start();
                oscillator.stop(ctx.currentTime + 0.24);

                setTimeout(() => ctx.close?.(), 350);
            } catch (e) {
                console.warn('Không phát được âm báo:', e.message);
            }
        }

        function showNewDefectToast(n) {
            const container = document.getElementById('notification-toast-container');
            if (!container) return;

            const toast = document.createElement('div');
            toast.className = 'pointer-events-auto ml-auto w-full md:w-[360px] bg-white border border-blue-100 shadow-2xl rounded-2xl p-4 animate-in cursor-pointer';

            toast.innerHTML = `
                <div class="flex gap-3">
                    <div class="w-11 h-11 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                        <i class="fas fa-bell"></i>
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="flex items-start justify-between gap-2">
                            <div class="font-extrabold text-slate-800 leading-snug">
                                ${escapeHtml(n.title || 'Có cập nhật hàng lỗi')}
                            </div>
                            <button type="button" class="text-slate-400 hover:text-red-500 shrink-0 px-1">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                        <div class="text-sm text-slate-600 mt-1 leading-relaxed">
                            ${escapeHtml(n.product_name || 'Sản phẩm được cập nhật')}
                            ${n.sku ? `<span class="font-mono text-blue-600"> - ITEM: ${escapeHtml(n.sku)}</span>` : ''}
                        </div>
                        <div class="text-xs text-slate-400 mt-1">
                            ${escapeHtml(n.message || ((n.actor_name || n.actor_username || 'Người dùng') + ' vừa cập nhật hàng lỗi'))}
                        </div>
                    </div>
                </div>
            `;

            toast.onclick = () => {
                markNotificationRead(n.id);
                toggleNotificationsPanel();
                toast.remove();
            };

            const closeBtn = toast.querySelector('button');
            if (closeBtn) {
                closeBtn.onclick = (e) => {
                    e.stopPropagation();
                    toast.remove();
                };
            }

            container.appendChild(toast);

            if (navigator.vibrate) {
                navigator.vibrate([180, 80, 180]);
            }

            playNotificationBeep();

            setTimeout(() => {
                toast.style.opacity = '0';
                toast.style.transform = 'translateY(-8px)';
                toast.style.transition = 'all .2s ease';
                setTimeout(() => toast.remove(), 220);
            }, 8000);
        }

        function checkAndShowNewNotificationToasts(newData) {
            if (!Array.isArray(newData) || !currentUser) return;

            const seenIds = getSeenNotificationIds();

            // Lần đầu đăng nhập/chạy app: đánh dấu đã thấy để không bung lại hàng loạt thông báo cũ.
            if (seenIds.length === 0) {
                setSeenNotificationIds(newData.map(n => n.id).filter(Boolean));
                return;
            }

            const newItems = newData
                .filter(n => n && n.id && !seenIds.includes(String(n.id)))
                .sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));

            if (newItems.length === 0) return;

            const updatedSeenIds = [...seenIds, ...newItems.map(n => String(n.id))];
            setSeenNotificationIds(updatedSeenIds);

            newItems
                .filter(n => ['defect_created', 'defect_fixing', 'defect_resolved', 'defect_status_updated'].includes(n.type))
                .slice(-3)
                .forEach(n => showNewDefectToast(n));
        }

        async function fetchNotifications(showErrorInPanel = true) {
            if (!supabaseClient || !currentUser) return;

            try {
                const { data, error } = await supabaseClient
                    .from('notifications')
                    .select('*')
                    .order('created_at', { ascending: false })
                    .limit(100);

                if (error) {
                    console.warn('Chưa đọc được bảng notifications:', error.message, error);
                    notificationsData = [];
                    renderNotifications();
                    if (showErrorInPanel) showNotificationReadError(error);
                    return;
                }

                const freshNotifications = data || [];
                checkAndShowNewNotificationToasts(freshNotifications);
                notificationsData = freshNotifications;
                renderNotifications();
            } catch (error) {
                console.warn('Lỗi tải thông báo:', error.message, error);
                notificationsData = [];
                renderNotifications();
                if (showErrorInPanel) showNotificationReadError(error);
            }
        }

        function showNotificationReadError(error) {
            const list = document.getElementById('notification-list');
            const countText = document.getElementById('notification-count-text');
            const badge = document.getElementById('notification-badge');
            if (countText) countText.innerText = 'Không đọc được thông báo';
            if (badge) {
                badge.classList.add('hidden');
                badge.classList.remove('flex');
            }
            clearPwaAppBadge();
            if (!list) return;
            list.innerHTML = `
                <div class="p-4 bg-red-50 text-red-700 text-sm leading-relaxed">
                    <div class="font-bold mb-1">Tài khoản này chưa đọc được bảng notifications.</div>
                    <div>${escapeHtml(error?.message || 'Lỗi không xác định')}</div>
                    <div class="mt-2 text-xs text-red-500">Thường do RLS policy của Supabase chưa cấp quyền SELECT cho role authenticated. Hãy chạy lại SQL tạo bảng/policy ở phần hướng dẫn.</div>
                </div>
            `;
        }

        function stopAutoRefresh() {
            if (notificationPollingTimer) clearInterval(notificationPollingTimer);
            if (dataPollingTimer) clearInterval(dataPollingTimer);
            notificationPollingTimer = null;
            dataPollingTimer = null;
        }

        function startAutoRefresh() {
            stopAutoRefresh();

            // Không dùng Supabase Realtime WebSocket nữa vì trình duyệt/mạng đang đóng WS trước khi kết nối.
            // Dùng polling để tài khoản app_users và Supabase Authentication đều cập nhật ổn định.
            notificationPollingTimer = setInterval(() => {
                if (currentUser) fetchNotifications(false);
            }, 10000);

            dataPollingTimer = setInterval(() => {
                if (!currentUser) return;
                fetchDefects();
                fetchCatalog();
                if (isAdmin()) fetchActivityLogs();
            }, 20000);
        }

        async function setupNotificationRealtime() {
            // Đã tắt realtime notifications để tránh lỗi WebSocket closed before connection is established.
            return;
        }

        async function refreshNotificationsAfterLogin() {
            await fetchNotifications(true);
            updatePushStatusUI();
            await syncExistingPushSubscription();
            startAutoRefresh();
        }


        async function createActivityLog(action, targetType, targetId, description, details = {}) {
            if (!supabaseClient || !currentUser) return;

            const actorName = currentDisplayName || currentUser.full_name || currentUser.username || currentUser.email || 'Người dùng';
            const actorUsername = currentUser.username || currentUser.email || currentUser.id || '';

            try {
                const { error } = await supabaseClient
                    .from('activity_logs')
                    .insert([{
                        action,
                        target_type: targetType,
                        target_id: targetId ? String(targetId) : null,
                        description,
                        actor_username: actorUsername,
                        actor_name: actorName,
                        actor_role: currentRole || 'staff',
                        details
                    }]);

                if (error) {
                    console.warn('Chưa ghi được activity_logs:', error.message);
                }
            } catch (error) {
                console.warn('Lỗi ghi nhật ký:', error.message);
            }
        }

        async function fetchActivityLogs() {
            if (!supabaseClient || !isAdmin()) return;

            try {
                const { data, error } = await supabaseClient
                    .from('activity_logs')
                    .select('*')
                    .order('created_at', { ascending: false })
                    .limit(300);

                if (error) {
                    console.warn('Chưa đọc được bảng activity_logs:', error.message);
                    activityLogsData = [];
                    renderActivityLogs();
                    return;
                }

                activityLogsData = data || [];
                renderActivityLogs();
            } catch (error) {
                console.warn('Lỗi tải nhật ký:', error.message);
            }
        }

        function setupActivityLogRealtime() {
            // Đã tắt realtime activity_logs để tránh lỗi WebSocket.
            return;
        }

        function getLogActionText(action) {
            const map = {
                login: 'Đăng nhập',
                logout: 'Đăng xuất',
                create: 'Thêm mới',
                update: 'Cập nhật/Sửa',
                delete: 'Xóa',
                import: 'Nhập Excel'
            };
            return map[action] || action || '-';
        }

        function getLogActionClass(action) {
            if (action === 'login') return 'bg-blue-50 text-blue-700 border-blue-200';
            if (action === 'logout') return 'bg-slate-50 text-slate-700 border-slate-200';
            if (action === 'create' || action === 'import') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
            if (action === 'update') return 'bg-orange-50 text-orange-700 border-orange-200';
            if (action === 'delete') return 'bg-red-50 text-red-700 border-red-200';
            return 'bg-slate-50 text-slate-700 border-slate-200';
        }

        function formatLogDetails(details) {
            if (!details || typeof details !== 'object') return '-';

            const pairs = Object.entries(details)
                .filter(([_, value]) => value !== undefined && value !== null && value !== '')
                .slice(0, 8)
                .map(([key, value]) => {
                    let textValue = value;
                    if (typeof value === 'object') textValue = JSON.stringify(value);
                    return `${key}: ${String(textValue)}`;
                });

            return pairs.length ? pairs.join(' | ') : '-';
        }

        function getFilteredActivityLogs() {
            const query = (logsSearch?.value || '').toLowerCase().trim();
            const actionFilter = document.getElementById('logs-action-filter')?.value || 'All';

            return activityLogsData.filter(log => {
                const detailsText = formatLogDetails(log.details || {}).toLowerCase();
                const searchStr = `${log.actor_username || ''} ${log.actor_name || ''} ${log.actor_role || ''} ${log.action || ''} ${log.target_type || ''} ${log.description || ''} ${detailsText}`.toLowerCase();
                const matchSearch = !query || searchStr.includes(query);
                const matchAction = actionFilter === 'All' || log.action === actionFilter;
                return matchSearch && matchAction;
            });
        }

        function renderActivityLogs() {
            const list = document.getElementById('logs-list');
            const mobileList = document.getElementById('logs-mobile-list');
            if (!list || !mobileList) return;

            if (!isAdmin()) {
                list.innerHTML = '';
                mobileList.innerHTML = '';
                return;
            }

            const rows = getFilteredActivityLogs();

            if (rows.length === 0) {
                list.innerHTML = `<tr><td colspan="6" class="px-6 py-8 text-center text-slate-400">Chưa có nhật ký hoặc chưa tạo bảng activity_logs</td></tr>`;
                mobileList.innerHTML = `<div class="bg-white border border-slate-200 rounded-2xl p-6 text-center text-slate-400 text-sm">Chưa có nhật ký hoặc chưa tạo bảng activity_logs</div>`;
                return;
            }

            list.innerHTML = rows.map(log => `
                <tr class="hover:bg-slate-50">
                    <td class="px-6 py-4 whitespace-nowrap text-xs font-medium text-slate-600">${formatDateTime(log.created_at)}</td>
                    <td class="px-6 py-4">
                        <div class="font-semibold text-slate-800">${log.actor_name || '-'}</div>
                        <div class="text-xs text-slate-400 font-mono">${log.actor_username || '-'}</div>
                        <div class="text-[10px] text-blue-600 font-bold uppercase">${log.actor_role || '-'}</div>
                    </td>
                    <td class="px-6 py-4">
                        <span class="inline-flex items-center rounded-lg border px-3 py-1 text-xs font-bold ${getLogActionClass(log.action)}">${getLogActionText(log.action)}</span>
                    </td>
                    <td class="px-6 py-4 text-sm font-mono text-slate-600">${log.target_type || '-'}</td>
                    <td class="px-6 py-4 text-sm text-slate-700">${log.description || '-'}</td>
                    <td class="px-6 py-4 text-xs text-slate-500 max-w-[320px] break-words">${formatLogDetails(log.details || {})}</td>
                </tr>
            `).join('');

            mobileList.innerHTML = rows.map(log => `
                <div class="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                    <div class="flex items-start justify-between gap-2">
                        <div>
                            <div class="font-bold text-slate-800">${log.actor_name || '-'}</div>
                            <div class="text-xs text-slate-400 font-mono">${log.actor_username || '-'}</div>
                        </div>
                        <span class="rounded-lg border px-2 py-1 text-[11px] font-bold ${getLogActionClass(log.action)}">${getLogActionText(log.action)}</span>
                    </div>
                    <div class="mt-2 text-xs text-slate-500">${formatDateTime(log.created_at)}</div>
                    <div class="mt-3 text-sm font-semibold text-slate-700">${log.description || '-'}</div>
                    <div class="mt-2 text-xs text-slate-500 break-words">${formatLogDetails(log.details || {})}</div>
                </div>
            `).join('');
        }

        function notificationIcon(type) {
            if (type === 'defect_created') return 'fa-circle-plus text-blue-600 bg-blue-50';
            if (type === 'defect_fixing') return 'fa-screwdriver-wrench text-orange-600 bg-orange-50';
            if (type === 'defect_resolved') return 'fa-circle-check text-green-600 bg-green-50';
            if (type === 'defect_status_updated') return 'fa-arrows-rotate text-indigo-600 bg-indigo-50';
            return 'fa-bell text-slate-600 bg-slate-100';
        }

        function renderNotifications() {
            const list = document.getElementById('notification-list');
            const badge = document.getElementById('notification-badge');
            const countText = document.getElementById('notification-count-text');

            if (!list || !badge || !countText) return;

            const unreadCount = notificationsData.filter(n => !isNotificationRead(n.id)).length;
            updatePwaAppBadge(unreadCount);

            countText.innerText = `${notificationsData.length} thông báo`;

            if (unreadCount > 0) {
                badge.innerText = unreadCount > 99 ? '99+' : unreadCount;
                badge.classList.remove('hidden');
                badge.classList.add('flex');
            } else {
                badge.classList.add('hidden');
                badge.classList.remove('flex');
            }

            if (notificationsData.length === 0) {
                list.innerHTML = `
                    <div class="p-6 text-center text-slate-400 text-sm">
                        Chưa có thông báo
                    </div>
                `;
                return;
            }

            list.innerHTML = notificationsData.map(n => {
                const read = isNotificationRead(n.id);
                const iconClass = notificationIcon(n.type);

                return `
                    <div onclick="markNotificationRead('${n.id}')"
                        class="p-4 cursor-pointer hover:bg-slate-50 transition-colors ${read ? 'bg-white' : 'bg-blue-50/60'}">

                        <div class="flex gap-3">
                            <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${iconClass.split(' ').slice(1).join(' ')}">
                                <i class="fas ${iconClass.split(' ')[0]}"></i>
                            </div>

                            <div class="flex-1 min-w-0">
                                <div class="flex items-start justify-between gap-2">
                                    <div class="font-bold text-sm text-slate-800 leading-snug">
                                        ${escapeHtml(n.title || 'Thông báo')}
                                    </div>

                                    ${read ? '' : '<span class="w-2.5 h-2.5 rounded-full bg-blue-600 shrink-0 mt-1"></span>'}
                                </div>

                                <div class="text-sm text-slate-600 mt-1 leading-relaxed">
                                    ${escapeHtml(n.message || '')}
                                </div>

                                <div class="flex flex-wrap gap-1 mt-2">
                                    ${n.product_name ? `<span class="text-[11px] bg-white border text-slate-600 px-2 py-0.5 rounded-full">${escapeHtml(n.product_name)}</span>` : ''}
                                    ${n.sku ? `<span class="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-mono">ITEM: ${escapeHtml(n.sku)}</span>` : ''}
                                    ${n.barcode ? `<span class="text-[11px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-mono">BC: ${escapeHtml(n.barcode)}</span>` : ''}
                                </div>

                                <div class="text-[11px] text-slate-400 mt-2">
                                    ${formatDateTime(n.created_at)}
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
        }

        function toggleNotificationsPanel() {
            const panel = document.getElementById('notification-panel');
            if (!panel) return;

            panel.classList.toggle('hidden');
            fetchNotifications();
        }

        function closeNotificationsPanel() {
            const panel = document.getElementById('notification-panel');
            if (panel) panel.classList.add('hidden');
        }

        function markNotificationRead(id) {
            const ids = getReadNotificationIds();
            ids.push(String(id));
            setReadNotificationIds(ids);
            renderNotifications();
        }

        function markAllNotificationsRead() {
            setReadNotificationIds(notificationsData.map(n => String(n.id)));
            renderNotifications();
        }

        function clearLocalNotificationsRead() {
            localStorage.removeItem(getNotificationReadKey());
            renderNotifications();
        }

        async function createNotification(type, defect, extra = {}) {
            if (!supabaseClient || !currentUser) return;

            const actorName = currentDisplayName || currentUser.full_name || currentUser.username || currentUser.email || 'Người dùng';
            const actorUsername = currentUser.username || currentUser.email || currentUser.id || '';

            let title = 'Thông báo mới';
            let message = '';
            const statusText = getStatusText(extra.status || defect.status);

            if (type === 'defect_created') {
                title = 'Có hàng lỗi mới';
                message = `${actorName} vừa cập nhật hàng lỗi mới: ${defect.product_name || 'N/A'}`;
            }

            if (type === 'defect_fixing') {
                title = 'Hàng lỗi đang sửa';
                message = `${actorName} đã cập nhật trạng thái Đang sửa cho: ${defect.product_name || 'N/A'}`;
            }

            if (type === 'defect_resolved') {
                title = 'Hàng lỗi đã xong';
                message = `${actorName} đã cập nhật trạng thái Xong cho: ${defect.product_name || 'N/A'}`;
            }

            if (type === 'defect_status_updated') {
                title = 'Cập nhật trạng thái hàng lỗi';
                message = `${actorName} đã cập nhật trạng thái ${statusText} cho: ${defect.product_name || 'N/A'}`;
            }

            try {
                const { data: insertedNotification, error } = await supabaseClient
                    .from('notifications')
                    .insert([{
                        type,
                        title,
                        message,
                        actor_username: String(actorUsername),
                        actor_name: actorName,
                        product_name: defect.product_name || '',
                        sku: defect.sku || '',
                        barcode: defect.barcode || '',
                        defect_id: defect.id || null,
                        status: extra.status || defect.status || null
                    }])
                    .select()
                    .single();

                if (error) {
                    console.warn('Không tạo được thông báo:', error.message);
                    return;
                }

                await sendWebPushForNotification(insertedNotification);
                await fetchNotifications();
            } catch (error) {
                console.warn('Lỗi tạo thông báo:', error.message);
            }
        }

		function openEditUserModal(id) {
			const user = appUsers.find(u => u.id === id);
			if (!user) return;

			document.getElementById('edit-user-id').value = user.id;
			document.getElementById('edit-full-name').value = user.full_name || '';
			document.getElementById('edit-role').value = user.role || 'staff';
			document.getElementById('edit-active').value = String(user.active);

			toggleModal('modal-edit-user', true);
		}

		document.getElementById('edit-user-form').onsubmit = async (e) => {
			e.preventDefault();

			const id = document.getElementById('edit-user-id').value;

			const payload = {
				full_name: document.getElementById('edit-full-name').value.trim(),
				role: document.getElementById('edit-role').value,
				active: document.getElementById('edit-active').value === 'true'
			};

			const { error } = await supabaseClient
				.from('app_users')
				.update(payload)
				.eq('id', id);

			if (error) {
				window.showToast("Lỗi cập nhật tài khoản: " + error.message);
				return;
			}

			await createActivityLog('update', 'app_users', id, 'Sửa tài khoản nội bộ', payload);

			toggleModal('modal-edit-user', false);
			await fetchUsers();
		};

		function isAdmin() {
			return currentRole === 'admin';
		}

		function isPO() {
			return currentRole === 'po';
		}

		function canManageData() {
			return currentRole === 'admin' || currentRole === 'po';
		}


        // Nâng cấp quyền tab: dùng một hàm trung tâm cho bottom nav, side menu và vuốt tab.
        function getAllowedTabs() {
            const role = currentRole || 'staff';
            const isMobile = window.innerWidth <= 768;
            const tabs = ['dashboard', 'history'];

            if (role === 'admin' || role === 'po') tabs.push('catalog');
            if (role === 'admin' || isMobile) tabs.push('users');
            if (role === 'admin') tabs.push('logs');

            return tabs;
        }

        window.getAllowedTabs = getAllowedTabs;

		function updateHelloUser() {

			const displayName = currentDisplayName || currentUser?.full_name || currentUser?.username || currentUser?.email || 'Người dùng';
			const username = currentUser?.username || currentUser?.email || displayName;

			const el = document.getElementById('hello-user');
			const menuNameEl = document.getElementById('user-menu-name');

			if (el) el.innerText = displayName;
			if (menuNameEl) menuNameEl.innerText = username;
		}


        const tableSortState = {
            dashboard: { key: 'created_at', direction: 'desc' },
            history: { key: 'created_at', direction: 'desc' },
            catalog: { key: 'product_name', direction: 'asc' },
            users: { key: 'created_at', direction: 'desc' }
        };

        const tableFilterState = {
            dashboard: {},
            history: {},
            catalog: {},
            users: {}
        };

        const FILTER_BLANK_VALUE = '__FILTER_BLANK__';

        function escapeHtml(value) {
            return String(value ?? '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        }

        function getFilterValue(row, key) {
            if (!row) return FILTER_BLANK_VALUE;

            if (key === 'status') {
                return row.status ? getStatusText(row.status) : FILTER_BLANK_VALUE;
            }

            if (key === 'active') {
                return row.active ? 'Hoạt động' : 'Đã khóa';
            }

            if (key === 'created_at') {
                return row.created_at ? formatDateTime(row.created_at) : FILTER_BLANK_VALUE;
            }

            const value = row[key];
            if (value === null || value === undefined || String(value).trim() === '') {
                return FILTER_BLANK_VALUE;
            }

            return String(value).trim();
        }

        function getFilterLabel(value) {
            return value === FILTER_BLANK_VALUE ? '(Trống)' : value;
        }

        function getSearchFilteredRows(tableName) {
            if (tableName === 'dashboard') {
                const query = (searchInput?.value || '').toLowerCase().trim();
                const statusFilter = document.getElementById('filter-status')?.value || 'All';

                return defectsData.filter(d => {
                    if (d.status === 'Resolved') return false;

                    const searchStr = `${d.product_name || ''} ${d.sku || ''} ${d.barcode || ''} ${d.vendor_name || ''} ${d.vendor_id || ''} ${d.defect_type || ''}`.toLowerCase();

                    let matchSearch = true;
                    if (query) {
                        if (query.includes('*')) {
                            const pattern = wildcardToRegex(query);
                            matchSearch = pattern.test(d.product_name || '') || pattern.test(d.barcode || '') || pattern.test(d.sku || '') || pattern.test(d.vendor_name || '') || pattern.test(d.vendor_id || '') || pattern.test(d.defect_type || '');
                        } else {
                            matchSearch = searchStr.includes(query);
                        }
                    }

                    const matchStatus = statusFilter === 'All' || d.status === statusFilter;
                    return matchSearch && matchStatus;
                });
            }

            if (tableName === 'history') {
                const query = (historySearch?.value || '').toLowerCase().trim();
                return defectsData.filter(d => {
                    if (d.status !== 'Resolved') return false;
                    const searchStr = `${d.product_name || ''} ${d.sku || ''} ${d.barcode || ''} ${d.vendor_name || ''} ${d.vendor_id || ''} ${d.defect_type || ''}`.toLowerCase();
                    return searchStr.includes(query);
                });
            }

            if (tableName === 'catalog') {
                const query = (catalogSearch?.value || '').toLowerCase().trim();
                return catalogData.filter(c => {
                    const searchStr = `${c.barcode || ''} ${c.product_name || ''} ${c.sku || ''} ${c.vendor_name || ''} ${c.vendor_id || ''}`.toLowerCase();
                    return searchStr.includes(query);
                });
            }

            if (tableName === 'users') {
                const query = (usersSearch?.value || '').toLowerCase().trim();
                return appUsers.filter(u => {
                    const searchStr = `${u.username || ''} ${u.full_name || ''} ${u.role || ''} ${u.active ? 'Hoạt động' : 'Đã khóa'}`.toLowerCase();
                    return searchStr.includes(query);
                });
            }

            return [];
        }

        function applyTableFilters(rows, tableName, exceptKey = null) {
            const filters = tableFilterState[tableName] || {};

            return rows.filter(row => {
                return Object.entries(filters).every(([key, selected]) => {
                    if (key === exceptKey) return true;
                    if (!selected || selected.length === 0) return true;
                    return selected.includes(getFilterValue(row, key));
                });
            });
        }

        function getFilterValues(tableName, key) {
            const rows = applyTableFilters(getSearchFilteredRows(tableName), tableName, key);
            const values = [...new Set(rows.map(row => getFilterValue(row, key)))];

            return values.sort((a, b) => getFilterLabel(a).localeCompare(getFilterLabel(b), 'vi', {
                numeric: true,
                sensitivity: 'base'
            }));
        }

        function closeExcelFilters() {
            document.querySelectorAll('.excel-filter-menu').forEach(menu => menu.classList.add('hidden'));
        }

        function enhanceExcelFilters() {
            document.querySelectorAll('th.sortable-th').forEach(th => {
                if (th.dataset.filterEnhanced === '1') return;

                const onclick = th.getAttribute('onclick') || '';
                const match = onclick.match(/sortTable\('([^']+)',\s*'([^']+)'\)/);
                if (!match) return;

                const tableName = match[1];
                const key = match[2];
                const oldButton = th.querySelector('button');
                if (oldButton) {
                    oldButton.classList.add('pr-8');
                }

                const filterBtn = document.createElement('button');
                filterBtn.type = 'button';
                filterBtn.className = 'excel-filter-btn';
                filterBtn.id = `filter-btn-${tableName}-${key}`;
                filterBtn.title = 'Bộ Lọc';
                filterBtn.innerHTML = '<i class="fas fa-filter text-xs"></i>';
                filterBtn.onclick = (event) => {
                    event.stopPropagation();
                    openExcelFilter(tableName, key);
                };

                const menu = document.createElement('div');
                menu.id = `filter-menu-${tableName}-${key}`;
                menu.className = 'excel-filter-menu hidden';
                menu.onclick = (event) => event.stopPropagation();

                th.appendChild(filterBtn);
                th.appendChild(menu);
                th.dataset.filterEnhanced = '1';
            });

            document.addEventListener('click', closeExcelFilters);
        }

        function openExcelFilter(tableName, key) {
            const menuId = `filter-menu-${tableName}-${key}`;
            const menu = document.getElementById(menuId);
            if (!menu) return;

            const wasHidden = menu.classList.contains('hidden');
            closeExcelFilters();
            if (!wasHidden) return;

            const values = getFilterValues(tableName, key);
            const currentSelected = tableFilterState[tableName]?.[key] || [];
            const selectedSet = new Set(currentSelected.length ? currentSelected : values);
            const isAllChecked = values.length > 0 && values.every(value => selectedSet.has(value));

            menu.innerHTML = `
                <div class="flex items-center justify-between gap-2 mb-2">
                    <div class="font-bold text-slate-700 text-sm">Lọc dữ liệu</div>
                    <button type="button" onclick="event.stopPropagation(); clearExcelFilter('${tableName}', '${key}')" class="text-xs text-blue-600 hover:underline">Hiện tất cả</button>
                </div>

                <input type="text"
                    placeholder="Tìm trong danh sách lọc..."
                    class="w-full mb-2 px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    oninput="filterExcelMenuOptions(this)"
                    onkeydown="handleExcelFilterEnter(event, '${tableName}', '${key}')">

                <label class="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-slate-50 text-sm font-semibold text-slate-700 border-b border-slate-100 mb-1">
                    <input type="checkbox" class="excel-select-all" ${isAllChecked ? 'checked' : ''} onchange="toggleExcelSelectAll(this)">
                    <span>Select All</span>
                </label>

                <div class="excel-filter-option-list space-y-1">
                    ${values.map(value => `
                        <label class="excel-filter-option flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 text-sm text-slate-700">
                            <input type="checkbox" class="excel-filter-checkbox" value="${escapeHtml(value)}" ${selectedSet.has(value) ? 'checked' : ''} onchange="syncExcelSelectAll(this)">
                            <span class="truncate" title="${escapeHtml(getFilterLabel(value))}">${escapeHtml(getFilterLabel(value))}</span>
                        </label>
                    `).join('') || '<div class="text-sm text-slate-400 px-2 py-3">Không có dữ liệu</div>'}
                </div>

                <div class="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-100">
                    <button type="button" onclick="event.stopPropagation(); closeExcelFilters()" class="py-2 rounded-lg bg-slate-100 text-slate-700 font-semibold text-sm">Hủy</button>
                    <button type="button" onclick="event.stopPropagation(); applyExcelFilter('${tableName}', '${key}')" class="py-2 rounded-lg bg-blue-600 text-white font-semibold text-sm">Áp dụng</button>
                </div>
            `;

            menu.classList.remove('hidden');
        }

        function getVisibleExcelFilterBoxes(menu) {
            return [...menu.querySelectorAll('.excel-filter-option')]
                .filter(option => option.style.display !== 'none')
                .map(option => option.querySelector('.excel-filter-checkbox'))
                .filter(Boolean);
        }

        function updateExcelSelectAllState(menu) {
            if (!menu) return;
            const visibleBoxes = getVisibleExcelFilterBoxes(menu);
            const selectAll = menu.querySelector('.excel-select-all');
            if (selectAll) {
                selectAll.checked = visibleBoxes.length > 0 && visibleBoxes.every(item => item.checked);
                selectAll.indeterminate = visibleBoxes.some(item => item.checked) && !selectAll.checked;
            }
        }

        function filterExcelMenuOptions(input) {
            const query = input.value.toLowerCase().trim();
            const menu = input.closest('.excel-filter-menu');
            if (!menu) return;

            menu.querySelectorAll('.excel-filter-option').forEach(option => {
                const text = option.innerText.toLowerCase();
                const matched = !query || text.includes(query);
                option.style.display = matched ? 'flex' : 'none';

                // Giống Excel: khi nhập từ khóa lọc, chỉ giữ tick các kết quả đang hiện.
                // Các dòng bị ẩn sẽ bỏ tick để bấm "Áp dụng" không còn hiểu là Select All.
                const box = option.querySelector('.excel-filter-checkbox');
                if (box && query) box.checked = matched;
            });

            updateExcelSelectAllState(menu);
        }

        function handleExcelFilterEnter(event, tableName, key) {
            if (event.key !== 'Enter') return;

            event.preventDefault();
            event.stopPropagation();
            applyExcelFilter(tableName, key);
        }

        function toggleExcelSelectAll(checkbox) {
            const menu = checkbox.closest('.excel-filter-menu');
            if (!menu) return;

            // Nếu đang gõ tìm trong menu lọc thì Select All chỉ áp dụng cho các dòng đang hiện.
            const searchQuery = menu.querySelector('input[type="text"]')?.value.trim() || '';
            const boxes = searchQuery
                ? getVisibleExcelFilterBoxes(menu)
                : [...menu.querySelectorAll('.excel-filter-checkbox')];

            boxes.forEach(item => item.checked = checkbox.checked);
            updateExcelSelectAllState(menu);
        }

        function syncExcelSelectAll(checkbox) {
            const menu = checkbox.closest('.excel-filter-menu');
            if (!menu) return;
            updateExcelSelectAllState(menu);
        }

        function applyExcelFilter(tableName, key) {
            const menu = document.getElementById(`filter-menu-${tableName}-${key}`);
            if (!menu) return;

            const allValues = getFilterValues(tableName, key);
            const searchQuery = menu.querySelector('input[type="text"]')?.value.trim() || '';
            const checkedBoxes = searchQuery
                ? getVisibleExcelFilterBoxes(menu).filter(item => item.checked)
                : [...menu.querySelectorAll('.excel-filter-checkbox:checked')];
            const checkedValues = checkedBoxes.map(item => item.value);

            if (checkedValues.length === 0) {
                tableFilterState[tableName][key] = ['__NO_MATCH__'];
            } else if (!searchQuery && checkedValues.length === allValues.length) {
                delete tableFilterState[tableName][key];
            } else {
                tableFilterState[tableName][key] = checkedValues;
            }

            closeExcelFilters();
            rerenderTable(tableName);
        }

        function clearExcelFilter(tableName, key) {
            if (tableFilterState[tableName]) {
                delete tableFilterState[tableName][key];
            }
            closeExcelFilters();
            rerenderTable(tableName);
        }

        function resetExcelFilters(tableName) {
            if (tableFilterState[tableName]) tableFilterState[tableName] = {};
            rerenderTable(tableName);
        }

        function resetTableFilters(tableName) {
            // Xóa bộ lọc tiêu đề giống Excel
            if (tableFilterState[tableName]) {
                tableFilterState[tableName] = {};
            }

            // Xóa ô tìm kiếm và bộ lọc thường của từng tab
            if (tableName === 'dashboard') {
                const search = document.getElementById('search-input');
                const status = document.getElementById('filter-status');
                if (search) search.value = '';
                if (status) status.value = 'All';
            }

            if (tableName === 'history') {
                const search = document.getElementById('history-search');
                if (search) search.value = '';
            }

            if (tableName === 'catalog') {
                const search = document.getElementById('catalog-search');
                if (search) search.value = '';
            }

            if (tableName === 'users') {
                const search = document.getElementById('users-search');
                if (search) search.value = '';
            }

            closeExcelFilters();
            rerenderTable(tableName);
        }

        function rerenderTable(tableName) {
            if (tableName === 'dashboard') renderDashboard();
            if (tableName === 'history') renderHistory();
            if (tableName === 'catalog') renderCatalog();
            if (tableName === 'users') renderUsers();
        }

        function updateFilterIndicators(tableName) {
            const filters = tableFilterState[tableName] || {};
            document.querySelectorAll(`[id^="filter-btn-${tableName}-"]`).forEach(btn => {
                btn.classList.remove('active-filter');
            });

            Object.keys(filters).forEach(key => {
                const btn = document.getElementById(`filter-btn-${tableName}-${key}`);
                if (btn) btn.classList.add('active-filter');
            });
        }

        function wildcardToRegex(input) {
            const escaped = input.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
            const pattern = '^' + escaped.replace(/\*/g, '.*') + '$';
            return new RegExp(pattern, 'i');
        }

        function sortTable(tableName, key) {
            const state = tableSortState[tableName];
            if (!state) return;

            if (state.key === key) {
                state.direction = state.direction === 'asc' ? 'desc' : 'asc';
            } else {
                state.key = key;
                state.direction = key === 'created_at' ? 'desc' : 'asc';
            }

            if (tableName === 'dashboard') renderDashboard();
            if (tableName === 'history') renderHistory();
            if (tableName === 'catalog') renderCatalog();
            if (tableName === 'users') renderUsers();
        }

        function getSortValue(row, key) {
            if (!row) return '';

            if (key === 'created_at') {
                return Date.parse(row.created_at || '') || 0;
            }

            if (key === 'quantity') {
                return Number(row.quantity || 0);
            }

            if (key === 'status') {
                return getStatusText(row.status || '');
            }

            if (key === 'active') {
                return row.active ? 'Hoạt động' : 'Đã khóa';
            }

            return String(row[key] ?? '').toLowerCase().trim();
        }

        function applyTableSort(rows, tableName) {
            const state = tableSortState[tableName];
            if (!state) return rows;

            const direction = state.direction === 'asc' ? 1 : -1;
            return rows.sort((a, b) => {
                const va = getSortValue(a, state.key);
                const vb = getSortValue(b, state.key);

                if (typeof va === 'number' && typeof vb === 'number') {
                    return (va - vb) * direction;
                }

                return String(va).localeCompare(String(vb), 'vi', {
                    numeric: true,
                    sensitivity: 'base'
                }) * direction;
            });
        }

        function updateSortIndicators(tableName) {
            const state = tableSortState[tableName];
            if (!state) return;

            document.querySelectorAll(`[id^="sort-${tableName}-"]`).forEach(icon => {
                icon.className = 'fas fa-sort text-slate-300';
                const th = icon.closest('th');
                if (th) th.classList.remove('active-sort');
            });

            const activeIcon = document.getElementById(`sort-${tableName}-${state.key}`);
            if (activeIcon) {
                activeIcon.className = `fas ${state.direction === 'asc' ? 'fa-sort-up' : 'fa-sort-down'} text-blue-600`;
                const th = activeIcon.closest('th');
                if (th) th.classList.add('active-sort');
            }
        }


        function parseDefectImageUrls(value) {
            if (!value) return [];

            if (Array.isArray(value)) return value;

            if (typeof value === 'string') {
                const raw = value.trim();
                if (!raw) return [];

                try {
                    const parsed = JSON.parse(raw);
                    if (Array.isArray(parsed)) return parsed;
                    if (parsed && typeof parsed === 'object') return Object.values(parsed);
                } catch (e) {}

                return raw
                    .split(/[\n,]+/)
                    .map(item => item.trim())
                    .filter(Boolean);
            }

            if (typeof value === 'object') return Object.values(value);
            return [];
        }

        function getDefectImageUrls(defect) {
            const urls = [];
            const addUrl = url => {
                if (!url) return;
                const clean = String(url).trim();
                if (!clean || urls.includes(clean)) return;
                urls.push(clean);
            };

            parseDefectImageUrls(defect?.image_url).forEach(addUrl);
            parseDefectImageUrls(defect?.image_urls).forEach(addUrl);
            parseDefectImageUrls(defect?.images).forEach(img => addUrl(img?.url || img));
            return urls;
        }

        function escapeJsString(value) {
            return String(value || '')
                .replace(/\\/g, '\\\\')
                .replace(/'/g, "\\'")
                .replace(/\r/g, '')
                .replace(/\n/g, '');
        }

        function escapeHtmlAttr(value) {
            return String(value || '')
                .replace(/&/g, '&amp;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');
        }

        function encodeImageUrlsAttr(urls) {
            return escapeHtmlAttr(JSON.stringify(urls || []));
        }

        function renderDefectImages(defect, mode = 'desktop') {
            const urls = getDefectImageUrls(defect);
            const isMobile = mode.includes('mobile');
            const emptySize = isMobile ? 'w-20 h-20' : 'w-12 h-12';
            const emptyIcon = isMobile ? 'text-2xl' : '';

            if (!urls.length) {
                return `<div class="${emptySize} rounded-xl bg-slate-100 flex items-center justify-center text-slate-300 shrink-0">
                    <i class="fas fa-image ${emptyIcon}"></i>
                </div>`;
            }

            const imagesJson = encodeImageUrlsAttr(urls);
            const previewClass = isMobile ? 'defect-image-review defect-image-review-mobile' : 'defect-image-review defect-image-review-desktop';
            const countBadge = urls.length > 1
                ? `<span class="defect-image-review-count"><i class="fas fa-images"></i> 1/${urls.length}</span>`
                : `<span class="defect-image-review-count single"><i class="fas fa-search-plus"></i></span>`;

            return `<button type="button"
                class="${previewClass}"
                data-images="${imagesJson}"
                onclick="event.stopPropagation(); openDefectImageGallery(JSON.parse(this.dataset.images || '[]'), 0)"
                title="Bấm để review ${urls.length} ảnh">
                <img src="${escapeHtmlAttr(urls[0])}" alt="Ảnh lỗi 1/${urls.length}" loading="lazy">
                ${countBadge}
            </button>`;
        }

        function renderDashboard() {
			const listContainer = document.getElementById('defect-list');
			listContainer.classList.add('opacity-50');
            let filtered = getSearchFilteredRows('dashboard');
            filtered = applyTableFilters(filtered, 'dashboard');
			filtered = applyTableSort(filtered, 'dashboard');
			updateSortIndicators('dashboard');
            updateFilterIndicators('dashboard');

            defectList.innerHTML = filtered.map(d => `
				<tr onclick="openStatusModal('${d.id}')" class="hover:bg-slate-50 group cursor-pointer">
					<td class="px-6 py-4 whitespace-nowrap">
						<div class="text-xs text-slate-600 font-medium">${formatDateTime(d.created_at)}</div>
					</td>
					<td class="px-6 py-4">
						<div class="flex items-center gap-3">
							${renderDefectImages(d, 'desktop')}
							<div>
								<div class="font-semibold text-slate-800">${d.product_name || 'N/A'}</div>
								<div class="flex flex-col gap-1 mt-1">
									<span class="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded w-fit">ITEM: ${d.sku || 'N/A'}</span>
									<span class="text-[10px] font-mono text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded w-fit">BC: ${d.barcode || 'N/A'}</span>
									<span class="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded w-fit">SL: ${d.quantity || 1}</span>
								</div>
							</div>
						</div>
					</td>
					<td class="px-6 py-4 text-sm text-slate-700">${d.vendor_name || '-'}</td>
					<td class="px-6 py-4 text-sm font-mono text-slate-600">${d.vendor_id || '-'}</td>
					<td class="px-6 py-4">
						<div class="text-sm font-medium">${d.defect_type || 'Lỗi chưa xác định'}</div>
						<span class="text-[10px] px-2 py-0.5 rounded-full border font-bold ${getSevClass(d.severity)}">${d.severity || 'Medium'}</span>
					</td>
					<td class="px-6 py-4">
						<span class="inline-flex items-center whitespace-nowrap text-sm rounded-lg border px-3 py-1 font-medium ${getStatusClass(d.status)}">
							${getStatusText(d.status)}
						</span>
					</td>
					<td class="px-6 py-4 text-right">
						${isAdmin() ? `
							<button onclick="event.stopPropagation(); deleteItem('defects', '${d.id}')" 
								class="text-red-500 bg-red-50 px-3 py-2 rounded-xl">
								<i class="fas fa-trash"></i>
							</button>
						` : ''}
					</td>
				</tr>
			`).join('');
			listContainer.classList.remove('opacity-50');
			
			document.getElementById('defect-mobile-list').innerHTML = filtered.map(d => `
				<div onclick="openStatusModal('${d.id}')" 
					 class="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm active:scale-[0.99] transition cursor-pointer">

					<div class="flex gap-3">
						${renderDefectImages(d, 'mobile')}

						<div class="flex-1 min-w-0">
							<div class="font-bold text-slate-800 text-base leading-snug">
								${d.product_name || 'N/A'}
							</div>

							<div class="text-xs text-slate-500 mt-1">
								${formatDateTime(d.created_at)}
							</div>

							<div class="flex flex-wrap gap-1 mt-2">
								<span class="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
									ITEM: ${d.sku || 'N/A'}
								</span>
								<span class="text-[11px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">
									BC: ${d.barcode || 'N/A'}
								</span>
								<span class="text-[11px] bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full font-bold">
									SL: ${d.quantity || 1}
								</span>
							</div>
						</div>
					</div>

					<div class="mt-3 grid grid-cols-2 gap-2 text-xs">
						<div class="bg-slate-50 rounded-xl p-2">
							<div class="text-slate-400">Tên NCC</div>
							<div class="font-semibold text-slate-700">${d.vendor_name || '-'}</div>
						</div>

						<div class="bg-slate-50 rounded-xl p-2">
							<div class="text-slate-400">Mã NCC</div>
							<div class="font-mono font-semibold text-slate-700">${d.vendor_id || '-'}</div>
						</div>
					</div>

					<div class="mt-3">
						<div class="text-xs text-slate-400">Mô tả lỗi</div>
						<div class="font-medium text-sm text-slate-700">${d.defect_type || 'Lỗi chưa xác định'}</div>
					</div>

					<div class="mt-3 flex items-center justify-between">
						<span class="text-xs rounded-full border px-3 py-1 font-bold ${getStatusClass(d.status)}">
							${getStatusText(d.status)}
						</span>

						${isAdmin() ? `
							<button onclick="event.stopPropagation(); deleteItem('defects', '${d.id}')" 
								class="text-red-500 bg-red-50 px-3 py-2 rounded-xl">
								<i class="fas fa-trash"></i>
							</button>
						` : ''}
					</div>
				</div>
			`).join('');
        }

		function renderHistory() {
			let historyData = getSearchFilteredRows('history');
            historyData = applyTableFilters(historyData, 'history');
			historyData = applyTableSort(historyData, 'history');
			updateSortIndicators('history');
            updateFilterIndicators('history');

			historyList.innerHTML = historyData.map(d => `
				<tr class="hover:bg-slate-50 group">
					<td class="px-6 py-4 whitespace-nowrap">
						<div class="text-xs text-slate-600 font-medium">${formatDateTime(d.created_at)}</div>
					</td>

					<td class="px-6 py-4">
						<div class="flex items-center gap-3">
							${renderDefectImages(d, 'desktop')}

							<div>
								<div class="font-semibold text-slate-800">${d.product_name || 'N/A'}</div>
								<div class="flex flex-col gap-1 mt-1">
									<span class="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded w-fit">ITEM: ${d.sku || 'N/A'}</span>
									<span class="text-[10px] font-mono text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded w-fit">BC: ${d.barcode || 'N/A'}</span>
									<span class="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded w-fit">SL: ${d.quantity || 1}</span>
								</div>
							</div>
						</div>
					</td>

					<td class="px-6 py-4 text-sm text-slate-700">${d.vendor_name || '-'}</td>
					<td class="px-6 py-4 text-sm font-mono text-slate-600">${d.vendor_id || '-'}</td>

					<td class="px-6 py-4">
						<div class="text-sm font-medium">${d.defect_type || 'Lỗi chưa xác định'}</div>
						<span class="text-[10px] px-2 py-0.5 rounded-full border font-bold ${getSevClass(d.severity)}">${d.severity || 'Medium'}</span>
					</td>

					<td class="px-6 py-4">
						<span class="inline-flex items-center whitespace-nowrap text-sm rounded-lg border px-3 py-1 font-medium ${getStatusClass(d.status)}">
							${getStatusText(d.status)}
						</span>
					</td>

					${isAdmin() ? `
						<td class="px-6 py-4 text-right">
							<button onclick="event.stopPropagation(); deleteHistoryItem('${d.id}')"
								class="text-red-500 bg-red-50 hover:bg-red-100 px-3 py-2 rounded-xl transition-colors"
								title="Chỉ xóa mục đã nằm trong lịch sử">
								<i class="fas fa-trash"></i>
							</button>
						</td>
					` : ''}
				</tr>
			`).join('');

			document.getElementById('history-mobile-list').innerHTML = historyData.map(d => `
				<div class="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
					<div class="flex gap-3">
						${renderDefectImages(d, 'mobile')}

						<div class="flex-1 min-w-0">
							<div class="font-bold text-slate-800 text-base leading-snug">
								${d.product_name || 'N/A'}
							</div>

							<div class="text-xs text-slate-500 mt-1">
								${formatDateTime(d.created_at)}
							</div>

							<div class="flex flex-wrap gap-1 mt-2">
								<span class="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
									ITEM: ${d.sku || 'N/A'}
								</span>
								<span class="text-[11px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">
									BC: ${d.barcode || 'N/A'}
								</span>
								<span class="text-[11px] bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full font-bold">
									SL: ${d.quantity || 1}
								</span>
							</div>
						</div>
					</div>

					<div class="mt-3">
						<div class="text-xs text-slate-400">Mô tả lỗi</div>
						<div class="font-medium text-sm text-slate-700">${d.defect_type || 'Lỗi chưa xác định'}</div>
					</div>

					<div class="mt-3 flex items-center justify-between gap-2">
						<span class="text-xs rounded-full border px-3 py-1 font-bold ${getStatusClass(d.status)}">
							${getStatusText(d.status)}
						</span>

						${isAdmin() ? `
							<button onclick="event.stopPropagation(); deleteHistoryItem('${d.id}')"
								class="text-red-500 bg-red-50 hover:bg-red-100 px-3 py-2 rounded-xl transition-colors">
								<i class="fas fa-trash"></i>
							</button>
						` : ''}
					</div>
				</div>
			`).join('');
		}

        function renderCatalog() {
			let filteredCatalog = getSearchFilteredRows('catalog');
            filteredCatalog = applyTableFilters(filteredCatalog, 'catalog');
			filteredCatalog = applyTableSort(filteredCatalog, 'catalog');
			updateSortIndicators('catalog');
            updateFilterIndicators('catalog');

			catalogList.innerHTML = filteredCatalog.map(c => `
				<tr class="hover:bg-slate-50 transition-colors">
					<td class="px-6 py-4 font-mono text-blue-600 text-sm font-bold">${c.barcode}</td>
					<td class="px-6 py-4 font-medium">${c.product_name}</td>
					<td class="px-6 py-4 font-mono text-xs">${c.sku}</td>
					<td class="px-6 py-4 text-sm text-slate-700">${c.vendor_name || '-'}</td>
					<td class="px-6 py-4 text-sm font-mono text-slate-600">${c.vendor_id || '-'}</td>
					<td class="px-6 py-4 text-right">
						<!-- <button onclick="deleteItem('catalog', '${c.id}')" class="text-red-300 hover:text-red-600 p-2">
							<i class="fas fa-times"></i>
						</button> -->
						<button onclick="event.stopPropagation(); deleteItem('catalog', '${c.id}')" 
							class="text-red-500 bg-red-50 px-3 py-2 rounded-xl">
							<i class="fas fa-trash"></i>
						</button>
					</td>
				</tr>
			`).join('');
			catalogMobileList.innerHTML = filteredCatalog.map(c => `
				<div class="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">

					<div class="flex items-start justify-between gap-3">
						<div class="min-w-0 flex-1">
							<div class="font-bold text-slate-800 text-base leading-snug">
								${c.product_name || 'N/A'}
							</div>

							<div class="flex flex-wrap gap-1 mt-2">
								<span class="text-[11px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-mono">
									BC: ${c.barcode || '-'}
								</span>

								<span class="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-mono">
									ITEM: ${c.sku || '-'}
								</span>
							</div>
						</div>

						${isAdmin() ? `
							<button onclick="event.stopPropagation(); deleteItem('catalog', '${c.id}')"
								class="text-red-500 bg-red-50 px-3 py-2 rounded-xl shrink-0">
								<i class="fas fa-trash"></i>
							</button>
						` : ''}
					</div>

					<div class="mt-3 grid grid-cols-2 gap-2 text-xs">
						<div class="bg-slate-50 rounded-xl p-2">
							<div class="text-slate-400">Tên NCC</div>
							<div class="font-semibold text-slate-700 truncate">
								${c.vendor_name || '-'}
							</div>
						</div>

						<div class="bg-slate-50 rounded-xl p-2">
							<div class="text-slate-400">Mã NCC</div>
							<div class="font-mono font-semibold text-slate-700 truncate">
								${c.vendor_id || '-'}
							</div>
						</div>
					</div>

				</div>
			`).join('');
		}

        async function updateDefectStatus(id, status) {
            await supabaseClient.from('defects').update({ status }).eq('id', id);
        }

        function getDefectStoragePath(imageUrl) {
            if (!imageUrl) return null;

            try {
                const url = new URL(imageUrl);
                const marker = '/defect-images/';
                const markerIndex = url.pathname.indexOf(marker);

                if (markerIndex !== -1) {
                    return decodeURIComponent(url.pathname.slice(markerIndex + marker.length));
                }

                const parts = url.pathname.split('/').filter(Boolean);
                const fileName = parts[parts.length - 1];
                return fileName ? `defects/${decodeURIComponent(fileName)}` : null;
            } catch (e) {
                const cleanUrl = String(imageUrl).split('?')[0];
                const fileName = cleanUrl.split('/').pop();
                return fileName ? `defects/${fileName}` : null;
            }
        }

        async function removeDefectImageFromStorage(imageUrl) {
            const filePath = getDefectStoragePath(imageUrl);
            if (!filePath) return;

            const { error } = await supabaseClient.storage
                .from('defect-images')
                .remove([filePath]);

            if (error) {
                console.error('Lỗi xóa ảnh Storage:', error.message);
            }
        }


        async function removeDefectImagesFromStorage(defect) {
            const imagePaths = [...new Set(
                getDefectImageUrls(defect)
                    .map(getDefectStoragePath)
                    .filter(Boolean)
            )];
            if (!imagePaths.length) return;

            const { error } = await supabaseClient.storage
                .from('defect-images')
                .remove(imagePaths);

            if (error) {
                console.error('Lỗi xóa nhiều ảnh Storage:', error.message);
            }
        }

        async function deleteHistoryItem(id) {
            if (!isAdmin()) {
                window.showToast('Chỉ admin mới được xóa lịch sử.');
                return;
            }

            const item = defectsData.find(d => String(d.id) === String(id));
            if (!item) {
                window.showToast('Không tìm thấy dữ liệu cần xóa.');
                return;
            }

            if (item.status !== 'Resolved') {
                window.showToast('Chỉ được xóa những mục đã chuyển qua tab Lịch sử (trạng thái Xong).');
                return;
            }

            if (!(await showConfirm('Xác nhận xóa mục lịch sử này? Thao tác này sẽ xóa cả hình ảnh đính kèm nếu có.', { title: 'Xóa mục lịch sử', confirmText: 'Xóa' }))) return;

            try {
                await removeDefectImagesFromStorage(item);

                const { error } = await supabaseClient
                    .from('defects')
                    .delete()
                    .eq('id', id)
                    .eq('status', 'Resolved');

                if (error) throw error;

                await createActivityLog('delete', 'defects', id, 'Xóa 1 mục trong tab lịch sử', {
                    product_name: item.product_name,
                    sku: item.sku,
                    barcode: item.barcode,
                    status: item.status
                });

                window.showToast('Đã xóa mục lịch sử thành công.');
                await fetchDefects();
            } catch (error) {
                console.error('Lỗi khi xóa lịch sử:', error);
                window.showToast('Có lỗi xảy ra khi xóa lịch sử: ' + error.message);
            }
        }

        async function deleteAllHistoryDefects() {
            if (!isAdmin()) {
                window.showToast('Chỉ admin mới được xóa lịch sử.');
                return;
            }

            const historyItems = defectsData.filter(d => d.status === 'Resolved');

            if (historyItems.length === 0) {
                window.showToast('Không có dữ liệu lịch sử để xóa.');
                return;
            }

            if (!(await showConfirm(`Bạn chắc chắn muốn xóa ${historyItems.length} mục đã nằm trong tab Lịch sử?`, { title: 'Xóa toàn bộ lịch sử', confirmText: 'Tiếp tục' }))) return;
            if (!(await showConfirm('Xác nhận lần cuối: thao tác này không thể hoàn tác và sẽ xóa cả ảnh đính kèm nếu có.', { title: 'Xác nhận lần cuối', confirmText: 'Xóa tất cả' }))) return;

            try {
                const imagePaths = [...new Set(
                    historyItems
                        .flatMap(d => getDefectImageUrls(d).map(getDefectStoragePath))
                        .filter(Boolean)
                )];

                if (imagePaths.length > 0) {
                    const { error: storageError } = await supabaseClient.storage
                        .from('defect-images')
                        .remove(imagePaths);

                    if (storageError) {
                        console.error('Lỗi xóa ảnh lịch sử Storage:', storageError.message);
                    }
                }

                const { error } = await supabaseClient
                    .from('defects')
                    .delete()
                    .eq('status', 'Resolved');

                if (error) throw error;

                await createActivityLog('delete', 'defects', null, 'Xóa toàn bộ dữ liệu trong tab lịch sử', {
                    count: historyItems.length,
                    image_count: imagePaths.length
                });

                window.showToast('Đã xóa toàn bộ dữ liệu trong tab lịch sử.');
                await fetchDefects();
            } catch (error) {
                console.error('Lỗi khi xóa toàn bộ lịch sử:', error);
                window.showToast('Có lỗi xảy ra khi xóa lịch sử: ' + error.message);
            }
        }

        async function deleteItem(table, id) {
			if (!(await showConfirm("Xác nhận xóa dữ liệu này? Thao tác này sẽ xóa cả hình ảnh đính kèm (nếu có).", { title: "Xóa dữ liệu", confirmText: "Xóa" }))) return;

			try {
				// 1. Nếu là bảng defects, cần xử lý xóa ảnh trong Storage trước
				if (table === 'defects') {
					// Lấy thông tin record để có image_url
					const { data: item, error: fetchError } = await supabaseClient
						.from('defects')
						.select('*')
						.eq('id', id)
						.single();

					if (fetchError) throw fetchError;

					// Nếu có ảnh, thực hiện xóa toàn bộ ảnh trong Storage
					if (item && getDefectImageUrls(item).length) {
						await removeDefectImagesFromStorage(item);
					}
				}

				// 2. Xóa dòng dữ liệu trong Table
				const { error: deleteError } = await supabaseClient
					.from(table)
					.delete()
					.eq('id', id);

				if (deleteError) throw deleteError;

				await createActivityLog('delete', table, id, `Xóa dữ liệu trong bảng ${table}`, { id });

				window.showToast("Đã xóa dữ liệu thành công!");

			} catch (error) {
				console.error("Lỗi khi xóa:", error);
				window.showToast("Có lỗi xảy ra khi xóa: " + error.message);
			}
		}



		function cleanTextValue(value) {
			if (value === null || value === undefined) return '';
			return String(value).trim();
		}

		function pickFirstValue(source, keys) {
			for (const key of keys) {
				if (source && source[key] !== undefined && source[key] !== null && String(source[key]).trim() !== '') {
					return String(source[key]).trim();
				}
			}
			return '';
		}

		function looksLikeVendorCode(value) {
			const v = cleanTextValue(value);
			if (!v) return false;
			// Mã NCC thường là số/ngắn hoặc dạng NCC-01, NCC001, SUP001...
			return /^[A-Z0-9._\-\/]{1,30}$/i.test(v) && !/\s/.test(v);
		}

		function looksLikeVendorName(value) {
			const v = cleanTextValue(value);
			if (!v) return false;
			return /\s/.test(v) || /công ty|cong ty|tnhh|cp|cổ phần|co\.ltd|company|npp|nhà cung cấp|nha cung cap/i.test(v);
		}

		function normalizeSupplierFields(source = {}) {
			let vendorName = pickFirstValue(source, [
				'vendor_name', 'vendorName', 'VendorName', 'vendor', 'supplier_name', 'SupplierName',
				'Tên NCC', 'Tên nhà cung cấp', 'Ten NCC', 'Ten nha cung cap', 'Nhà cung cấp', 'Nha cung cap'
			]);
			let vendorId = pickFirstValue(source, [
				'vendor_id', 'vendorId', 'VendorId', 'supplier_id', 'SupplierId', 'supplier_code', 'SupplierCode',
				'Mã NCC', 'Mã nhà cung cấp', 'Ma NCC', 'Ma nha cung cap', 'Mã Ncc', 'Ma Ncc'
			]);

			// Chống trường hợp file Excel hoặc dữ liệu cũ bị đảo cột: mã nằm ở ô tên, tên nằm ở ô mã.
			if (looksLikeVendorCode(vendorName) && looksLikeVendorName(vendorId)) {
				[vendorName, vendorId] = [vendorId, vendorName];
			}

			return {
				vendor_name: vendorName,
				vendor_id: vendorId
			};
		}

        document.getElementById('defect-form').onsubmit = async (e) => {
			e.preventDefault();
			const submitBtn = e.target.querySelector('button[type="submit"]');
			const imageInput = document.getElementById('f-image');
			const imageFile = imageInput?.files?.[0];
			const defectTypeInput = e.target.querySelector('[name="defect_type"]');
			const defectType = cleanTextValue(defectTypeInput?.value);
			let imageUrl = null;

			// Điều kiện bắt buộc: phải có mô tả lỗi và hình ảnh mới được lưu báo cáo.
			if (!defectType) {
				window.showToast('Vui lòng nhập Mô tả lỗi trước khi lưu báo cáo.');
				defectTypeInput?.focus();
				return;
			}

			if (!imageFile) {
				window.showToast('Vui lòng chọn Hình ảnh sản phẩm lỗi trước khi lưu báo cáo.');
				imageInput?.focus();
				return;
			}

			try {
				showAppLoading('Đang lưu báo cáo lỗi...', 'Đang nén ảnh và gửi dữ liệu lên Supabase');
				submitBtn.disabled = true;
				submitBtn.innerText = "Đang xử lý...";

				if (imageFile) {
					// --- BẮT ĐẦU PHẦN NÉN ẢNH ---
					const options = {
						maxSizeMB: 0.8,          // Kích thước tối đa (~800KB)
						maxWidthOrHeight: 1280, // Độ phân giải tối đa (HD)
						useWebWorker: true
					};
					
					submitBtn.innerText = "Đang nén ảnh...";
					const compressedFile = await imageCompression(imageFile, options);
					// --- KẾT THÚC PHẦN NÉN ẢNH ---

					const fileExt = imageFile.name.split('.').pop();
					const fileName = `${Math.random()}.${fileExt}`;
					const filePath = `defects/${fileName}`;

					// Sử dụng compressedFile thay vì imageFile
					const { data: uploadData, error: uploadError } = await supabaseClient.storage
						.from('defect-images')
						.upload(filePath, compressedFile);

					if (uploadError) throw uploadError;

					const { data: publicUrlData } = supabaseClient.storage
						.from('defect-images')
						.getPublicUrl(filePath);
					
					imageUrl = publicUrlData.publicUrl;
				}

				// 2. Lưu dữ liệu vào Table 'defects'
				// Tạo payload rõ ràng để tránh sai cột Mã NCC / Tên NCC khi lưu database.
					const formData = Object.fromEntries(new FormData(e.target));
					const supplier = normalizeSupplierFields(formData);
					const payload = {
						barcode: cleanTextValue(formData.barcode || document.getElementById('auto-barcode')?.value),
						product_name: cleanTextValue(formData.product_name),
						sku: cleanTextValue(formData.sku),
						vendor_name: supplier.vendor_name,
						vendor_id: supplier.vendor_id,
						defect_type: defectType,
						quantity: Number(formData.quantity || 1),
						severity: cleanTextValue(formData.severity || 'Medium'),
						status: cleanTextValue(formData.status || 'Pending'),
						image_url: imageUrl
					};

				const { data: insertedDefect, error } = await supabaseClient
					.from('defects')
					.insert([payload])
					.select()
					.single();
				
				if (error) throw error;

				await createNotification('defect_created', insertedDefect || payload);
				await createActivityLog('create', 'defects', (insertedDefect || payload).id, `Thêm báo lỗi mới: ${(insertedDefect || payload).product_name || '-'}`, { sku: (insertedDefect || payload).sku, barcode: (insertedDefect || payload).barcode, vendor_id: (insertedDefect || payload).vendor_id, quantity: (insertedDefect || payload).quantity, status: (insertedDefect || payload).status });

				// Thành công: Reset form và đóng modal
				toggleModal('modal-defect', false);
				e.target.reset();
				document.getElementById('image-preview')?.classList.add('hidden');
				window.showToast("Đã lưu báo cáo thành công!");

			} catch (error) {
				window.showToast("Lỗi: " + error.message);
			} finally {
				hideAppLoading(true);
				submitBtn.disabled = false;
				submitBtn.innerText = "Lưu báo cáo";
			}
		};
        document.getElementById('catalog-form').onsubmit = async (e) => {
            e.preventDefault();
            const formData = Object.fromEntries(new FormData(e.target));
	            const supplier = normalizeSupplierFields(formData);
	            const payload = {
	                barcode: cleanTextValue(formData.barcode),
	                product_name: cleanTextValue(formData.product_name),
	                sku: cleanTextValue(formData.sku),
	                vendor_name: supplier.vendor_name,
	                vendor_id: supplier.vendor_id
	            };
	            showAppLoading('Đang lưu danh mục...', 'Đang kiểm tra và thêm sản phẩm vào Supabase');
	            try {
	                const { data: insertedCatalog, error } = await supabaseClient
	                    .from('catalog')
	                    .insert([payload])
                    .select()
                    .single();
                if (!error) {
                    await createActivityLog('create', 'catalog', (insertedCatalog || payload).id, `Thêm danh mục: ${(insertedCatalog || payload).product_name || '-'}`, { sku: (insertedCatalog || payload).sku, barcode: (insertedCatalog || payload).barcode, vendor_id: (insertedCatalog || payload).vendor_id });
                    toggleModal('modal-catalog', false);
                    e.target.reset();
                } else {
                    window.showToast("Lỗi khi lưu danh mục (Kiểm tra tên cột DB): " + error.message);
                }
            } finally {
                hideAppLoading(true);
            }
        };

        document.getElementById('excel-input').onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = async (evt) => {
                showAppLoading('Đang nhập danh mục...', 'Đang đọc Excel và lưu dữ liệu');
                try {
                const workbook = XLSX.read(evt.target.result, { type: 'binary' });
                const json = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
                
                const rows = json.map(row => ({
                    barcode: String(row.Mahang || row.Barcode || row["Mã vạch"] || "").trim(),
                    product_name: cleanTextValue(row.Tenhang || row.ProductName || row["Tên sản phẩm"] || row["Tên hàng"]),
                    sku: cleanTextValue(row.MaSanPham || row.SKU || row["Item"]),
                    ...normalizeSupplierFields(row)
                })).filter(r => r.barcode && r.product_name);

                if (rows.length === 0) {
                    window.showToast("Không tìm thấy dữ liệu hợp lệ trong file Excel.");
                    return;
                }

                const { error } = await supabaseClient.from('catalog').insert(rows);
                if (error) window.showToast("Lỗi khi nhập liệu: " + error.message);
                else {
                    await createActivityLog('import', 'catalog', null, `Nhập Excel danh mục: ${rows.length} sản phẩm`, { count: rows.length });
                    window.showToast(`Đã nhập thành công ${rows.length} sản phẩm.`);
                }
                } finally {
                    hideAppLoading(true);
                }
            };
            reader.readAsBinaryString(file);
            e.target.value = ''; 
        };

		document.getElementById('defect-excel-input').onchange = (e) => {
			const file = e.target.files[0];
			if (!file) return;

			const reader = new FileReader();

			reader.onload = async (evt) => {
				showAppLoading('Đang nhập báo cáo lỗi...', 'Đang đọc Excel và lưu danh sách báo lỗi');
				try {
				const workbook = XLSX.read(evt.target.result, { type: 'binary' });
				const sheet = workbook.Sheets[workbook.SheetNames[0]];
				const json = XLSX.utils.sheet_to_json(sheet);

				const rows = json.map(row => {
					const statusText = String(row["Trạng thái"] || row.Status || "Pending").trim();

					let status = "Pending";
					if (statusText === "Đang sửa" || statusText === "Fixing") status = "Fixing";
					if (statusText === "Xong" || statusText === "Resolved" || statusText === "Đã hoàn thành") status = "Resolved";

					return {
						barcode: String(row["Barcode"] || row["Mã vạch"] || "").trim(),
						product_name: cleanTextValue(row["Tên sản phẩm"] || row.ProductName || row.Tenhang),
						sku: String(row["SKU"] || row["Item"] || row.MaSanPham || "").trim(),
						...normalizeSupplierFields(row),
						defect_type: row["Mô tả lỗi"] || row["Loại lỗi"] || "",
						quantity: Number(row["Số lượng"] || row.Quantity || 1),
						severity: row["Mức độ"] || row.Severity || "Medium",
						status: status
					};
				}).filter(r => r.product_name && r.defect_type);

				if (rows.length === 0) {
					window.showToast("Không tìm thấy dữ liệu báo lỗi hợp lệ trong file Excel.");
					return;
				}

				const { error } = await supabaseClient
					.from('defects')
					.insert(rows);

				if (error) {
					window.showToast("Lỗi khi nhập báo lỗi: " + error.message);
				} else {
					window.showToast(`Đã nhập thành công ${rows.length} dòng báo lỗi.`);
					await createNotification('defect_created', {
						product_name: `Nhập Excel ${rows.length} dòng báo lỗi`,
						sku: '',
						barcode: ''
					});
					await fetchDefects();
				}
				} finally {
					hideAppLoading(true);
				}
			};

			reader.readAsBinaryString(file);
			e.target.value = '';
		};

		document.addEventListener('keydown', (e) => {

			const loginScreen = document.getElementById('login-screen');

			// chỉ hoạt động khi màn login đang mở
			if (!loginScreen.classList.contains('hidden')) {

				if (e.key === 'Enter') {
					loginApp();
				}

			}

		});




        window.toggleUserMenu = (show) => {
            const panel = document.getElementById('user-menu-panel');
            if (!panel) return;
            const shouldShow = typeof show === 'boolean' ? show : !panel.classList.contains('show');
            panel.classList.toggle('show', shouldShow);
            panel.setAttribute('aria-hidden', shouldShow ? 'false' : 'true');
        };

        document.addEventListener('click', (e) => {
            const wrap = e.target.closest('.user-menu-wrap');
            if (!wrap) toggleUserMenu(false);
        });

        window.toggleSideMenu = (show) => {
            const overlay = document.getElementById('side-menu-overlay');
            const panel = document.getElementById('side-menu-panel');
            if (overlay) overlay.classList.toggle('show', !!show);
            if (panel) {
                panel.classList.toggle('show', !!show);
                panel.setAttribute('aria-hidden', show ? 'false' : 'true');
            }
            document.body.classList.toggle('modal-open', !!show);
        };

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closePasswordPopup();
                toggleSideMenu(false);
                toggleUserMenu(false);
            }
        });

        window.switchTab = (tab, options = {}) => {

            const silent = !!options.silent;

			const toggleHidden = (id, hidden) => {
				const el = document.getElementById(id);
				if (el) el.classList.toggle('hidden', hidden);
			};

			const toggleClass = (id, className, enabled) => {
				const el = document.getElementById(id);
				if (el) el.classList.toggle(className, enabled);
			};

			if (typeof updateBodyRoleClass === 'function') {
				updateBodyRoleClass();
			}

			if (tab === 'catalog' && !canManageData()) {
				if (!silent) window.showToast("Bạn không có quyền truy cập danh mục hàng hóa.");
				tab = 'dashboard';
			}

			if (tab === 'users' && !isAdmin()) {
				const isMobileAccountTab = window.innerWidth <= 768;
				if (!isMobileAccountTab) {
					if (!silent) window.showToast("Bạn không có quyền truy cập quản lý tài khoản.");
					tab = 'dashboard';
				}
			}

			if (tab === 'logs' && !isAdmin()) {
				if (!silent) window.showToast("Chỉ admin mới được xem nhật ký hoạt động.");
				tab = 'dashboard';
			}

            document.body.classList.remove('active-tab-dashboard', 'active-tab-history', 'active-tab-catalog', 'active-tab-users', 'active-tab-logs');
            document.body.classList.add('active-tab-' + tab);

			// views
			toggleHidden('view-dashboard', tab !== 'dashboard');
			toggleHidden('view-history', tab !== 'history');
			toggleHidden('view-catalog', tab !== 'catalog');
			toggleHidden('view-users', tab !== 'users');
			toggleHidden('view-logs', tab !== 'logs');

			if (tab === 'users' && window.innerWidth <= 768 && !isAdmin()) {
				setTimeout(() => switchAccountSubTab('personal'), 0);
			}

			// tabs active
			toggleClass('tab-dashboard', 'tab-active', tab === 'dashboard');
			toggleClass('tab-history', 'tab-active', tab === 'history');
			toggleClass('tab-catalog', 'tab-active', tab === 'catalog');
			toggleClass('tab-users', 'tab-active', tab === 'users');
			toggleClass('tab-logs', 'tab-active', tab === 'logs');

			// text colors
			toggleClass('tab-dashboard', 'text-slate-500', tab !== 'dashboard');
			toggleClass('tab-history', 'text-slate-500', tab !== 'history');
			toggleClass('tab-catalog', 'text-slate-500', tab !== 'catalog');
			toggleClass('tab-users', 'text-slate-500', tab !== 'users');
			toggleClass('tab-logs', 'text-slate-500', tab !== 'logs');
				
			if (tab === 'users') {
				fetchUsers();
			}

			if (tab === 'logs') {
				fetchActivityLogs();
			}
			
			['dashboard', 'history', 'catalog', 'users', 'logs'].forEach(name => {
				const el = document.getElementById(`m-tab-${name}`);
				if (!el) return;

				const active = tab === name;

				el.classList.toggle('text-blue-600', active);
				el.classList.toggle('bg-blue-50', active);
				el.classList.toggle('text-slate-500', !active);
			});

            ['dashboard', 'history', 'catalog', 'users', 'logs'].forEach(name => {
                const el = document.getElementById(`side-tab-${name}`);
                if (!el) return;
                el.classList.toggle('active', tab === name);
            });
		};

        window.toggleModal = (id, show) => {
            const modal = document.getElementById(id);
            if (!modal) return;

            modal.classList.toggle('hidden', !show);

            // Khi mở form/modal trên mobile thì ẩn nút nổi dấu cộng,
            // tránh nút còn đè lên bảng nhập thông tin.
            const hasOpenModal = Array.from(document.querySelectorAll('[id^=\"modal-\"]'))
                .some(el => !el.classList.contains('hidden'));

            document.body.classList.toggle('modal-open', hasOpenModal);
        };

        window.downloadSampleExcel = () => {
            const data = [{"Mahang":"893123456789","Tenhang":"Sản phẩm Mẫu A","MaSanPham":"SKU-001","VendorName":"Công ty TNHH ABC","VendorId":"NCC-01"}];
            const ws = XLSX.utils.json_to_sheet(data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Danh mục");
            XLSX.writeFile(wb, "Mau_Nhap_Danh_Muc.xlsx");
        };

        function updateStatusUI(status) {
            const dot = document.getElementById('status-dot');
            const text = document.getElementById('status-text');
            if (status === 'online') {
                dot.className = "w-2 h-2 rounded-full bg-green-500";
                text.innerText = "Kết nối thành công";
            } else if (status === 'offline') {
                dot.className = "w-2 h-2 rounded-full bg-red-500";
                text.innerText = "Kết nối thất bại";
            }
        }

		// Gallery xem ảnh lỗi: ảnh lớn phía trên, thumbnail toàn bộ ảnh bên dưới.
		let defectImageGalleryUrls = [];
		let defectImageGalleryIndex = 0;

		function getSafeGalleryUrls(urls) {
			return (Array.isArray(urls) ? urls : [urls])
				.map(url => String(url || '').trim())
				.filter(Boolean)
				.filter((url, index, arr) => arr.indexOf(url) === index);
		}

		function updateDefectImageGallery() {
			const img = document.getElementById('full-res-image');
			const downloadLink = document.getElementById('download-link');
			const counter = document.getElementById('image-gallery-counter');
			const thumbs = document.getElementById('image-gallery-thumbs');
			const prevBtn = document.getElementById('image-gallery-prev');
			const nextBtn = document.getElementById('image-gallery-next');
			const total = defectImageGalleryUrls.length;

			if (!img || !downloadLink) return;

			if (!total) {
				img.src = '';
				if (counter) counter.innerText = '0/0';
				if (thumbs) thumbs.innerHTML = '';
				return;
			}

			if (defectImageGalleryIndex < 0) defectImageGalleryIndex = total - 1;
			if (defectImageGalleryIndex >= total) defectImageGalleryIndex = 0;

			const currentUrl = defectImageGalleryUrls[defectImageGalleryIndex];
			img.src = currentUrl;
			img.alt = `Ảnh lỗi ${defectImageGalleryIndex + 1}/${total}`;
			downloadLink.href = currentUrl;
			downloadLink.setAttribute('download', `defect_${defectImageGalleryIndex + 1}_${Date.now()}.jpg`);

			if (counter) counter.innerText = `${defectImageGalleryIndex + 1}/${total}`;
			if (prevBtn) prevBtn.classList.toggle('hidden', total <= 1);
			if (nextBtn) nextBtn.classList.toggle('hidden', total <= 1);

			if (thumbs) {
				thumbs.innerHTML = defectImageGalleryUrls.map((url, index) => `
					<button type="button"
						class="image-gallery-thumb ${index === defectImageGalleryIndex ? 'active' : ''}"
						onclick="event.stopPropagation(); setDefectImageGalleryIndex(${index})"
						title="Xem ảnh ${index + 1}/${total}">
						<img src="${escapeHtmlAttr(url)}" alt="Ảnh nhỏ ${index + 1}" loading="lazy">
					</button>
				`).join('');
			}
		}

		function openDefectImageGallery(urls, startIndex = 0) {
			defectImageGalleryUrls = getSafeGalleryUrls(urls);
			defectImageGalleryIndex = Math.max(0, Math.min(Number(startIndex) || 0, defectImageGalleryUrls.length - 1));
			updateDefectImageGallery();
			toggleImageModal(true);
		}

		function setDefectImageGalleryIndex(index) {
			defectImageGalleryIndex = Number(index) || 0;
			updateDefectImageGallery();
		}

		function prevDefectImage() {
			if (!defectImageGalleryUrls.length) return;
			defectImageGalleryIndex = (defectImageGalleryIndex - 1 + defectImageGalleryUrls.length) % defectImageGalleryUrls.length;
			updateDefectImageGallery();
		}

		function nextDefectImage() {
			if (!defectImageGalleryUrls.length) return;
			defectImageGalleryIndex = (defectImageGalleryIndex + 1) % defectImageGalleryUrls.length;
			updateDefectImageGallery();
		}

		// Giữ hàm cũ để các chỗ onclick cũ không bị lỗi.
		function viewImage(url) {
			openDefectImageGallery([url], 0);
		}

		function toggleImageModal(show) {
			const modal = document.getElementById('modal-image');
			if (!modal) return;

			if (show) {
				modal.classList.remove('hidden');
				document.body.classList.add('image-modal-open');
			} else {
				modal.classList.add('hidden');
				document.body.classList.remove('image-modal-open');
				const img = document.getElementById('full-res-image');
				if (img) img.src = '';
			}
		}

		async function downloadImage(url) {
			const response = await fetch(url);
			const blob = await response.blob();
			const blobUrl = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = blobUrl;
			a.download = `defect-image-${Date.now()}.jpg`;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(blobUrl);
		}

        const getSevClass = (s) => ({'High':'text-red-700 bg-red-50 border-red-200','Medium':'text-yellow-700 bg-yellow-50 border-yellow-200','Low':'text-blue-700 bg-blue-50 border-blue-200'}[s] || 'text-slate-700 bg-slate-50 border-slate-200');
        const getStatusClass = (s) => ({'Resolved':'bg-green-100 text-green-800 border-green-200','Fixing':'bg-orange-100 text-orange-800 border-orange-200','Pending':'bg-yellow-100 text-yellow-800 border-yellow-200'}[s] || 'bg-slate-50');

        const updateStats = () => {
			const totalItems = defectsData.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
			document.getElementById('stat-total').innerText = totalItems;
            //document.getElementById('stat-total').innerText = defectsData.length;
            document.getElementById('stat-pending').innerText = defectsData.filter(d => d.status === 'Pending').length;
            document.getElementById('stat-fixing').innerText = defectsData.filter(d => d.status === 'Fixing').length;
            document.getElementById('stat-resolved').innerText = defectsData.filter(d => d.status === 'Resolved').length;
        };

        searchInput.oninput = renderDashboard;
		catalogSearch?.addEventListener('input', renderCatalog);
		historySearch?.addEventListener('input', renderHistory);
		usersSearch?.addEventListener('input', renderUsers);
		logsSearch?.addEventListener('input', renderActivityLogs);
		document.getElementById('logs-action-filter')?.addEventListener('change', renderActivityLogs);
        


        let barcodeDetectorCtor = null;
        let barcodeDetectorInstance = null;
        let barcodeVideoEl = null;
        let barcodeCanvasEl = null;
        let barcodeCanvasCtx = null;
        let barcodeScannerStream = null;
        let barcodeDetectLoopTimer = null;
        let barcodeScannerRunning = false;
        let barcodeScannerLocked = false;
        let barcodeScanCandidate = '';
        let barcodeScanCandidateCount = 0;
        let barcodeScanLastAt = 0;

        function setBarcodeScanStatus(message, type = 'info') {
            const el = document.getElementById('barcode-scan-status');
            if (!el) return;

            el.innerText = message;
            el.className = 'text-sm rounded-xl px-3 py-2 border ' + (
                type === 'error'
                    ? 'text-red-600 bg-red-50 border-red-200'
                    : type === 'success'
                        ? 'text-green-700 bg-green-50 border-green-200'
                        : type === 'warning'
                            ? 'text-amber-700 bg-amber-50 border-amber-200'
                            : 'text-slate-500 bg-slate-50 border-slate-200'
            );
        }

        function normalizeBarcodeText(value) {
            return String(value || '')
                .replace(/\s+/g, '')
                .replace(/[^\d]/g, '')
                .trim();
        }

        function isValidGtinChecksum(code) {
            const digits = normalizeBarcodeText(code);

            if (![8, 12, 13, 14].includes(digits.length)) return false;
            if (!/^\d+$/.test(digits)) return false;

            const numbers = digits.split('').map(Number);
            const checkDigit = numbers.pop();

            let sum = 0;
            let weight = 3;

            for (let i = numbers.length - 1; i >= 0; i--) {
                sum += numbers[i] * weight;
                weight = weight === 3 ? 1 : 3;
            }

            const expected = (10 - (sum % 10)) % 10;
            return expected === checkDigit;
        }

        function isBarcodeInCatalog(code) {
            const normalized = normalizeBarcodeText(code);
            if (!normalized || !Array.isArray(catalogData) || catalogData.length === 0) return false;

            return catalogData.some(item => normalizeBarcodeText(item.barcode) === normalized);
        }

        function resetBarcodeScanConfirm() {
            barcodeScanCandidate = '';
            barcodeScanCandidateCount = 0;
            barcodeScanLastAt = 0;
        }

        function fillBarcodeFromCamera(code) {
            const barcodeInput = document.getElementById('auto-barcode');
            if (!barcodeInput) return;

            barcodeInput.value = normalizeBarcodeText(code);
            barcodeInput.dispatchEvent(new Event('input', { bubbles: true }));
        }

        async function ensureBarcodeDetectorSupport() {
            if (barcodeDetectorCtor) return barcodeDetectorCtor;

            if ('BarcodeDetector' in window) {
                barcodeDetectorCtor = window.BarcodeDetector;
                return barcodeDetectorCtor;
            }

            setBarcodeScanStatus('Đang tải thư viện barcode-detector...');
            try {
                const mod = await import('https://cdn.jsdelivr.net/npm/barcode-detector@2/dist/es/index.min.js');
                barcodeDetectorCtor =
                    mod.BarcodeDetector ||
                    mod.default?.BarcodeDetector ||
                    mod.default ||
                    window.BarcodeDetector;

                if (!barcodeDetectorCtor) {
                    throw new Error('Không khởi tạo được BarcodeDetector từ CDN.');
                }

                return barcodeDetectorCtor;
            } catch (error) {
                console.error('Lỗi tải barcode-detector polyfill:', error);
                throw new Error('Không tải được barcode-detector. Kiểm tra Internet hoặc trình duyệt.');
            }
        }

        async function createBarcodeDetectorInstance() {
            const Detector = await ensureBarcodeDetectorSupport();

            let formats = ['ean_13', 'ean_8', 'upc_a', 'upc_e'];
            try {
                if (typeof Detector.getSupportedFormats === 'function') {
                    const supported = await Detector.getSupportedFormats();
                    const desired = ['ean_13', 'ean_8', 'upc_a', 'upc_e'];
                    const filtered = desired.filter(f => supported.includes(f));
                    if (filtered.length) formats = filtered;
                }
            } catch (error) {
                console.warn('Không lấy được supported formats, dùng mặc định.', error);
            }

            return new Detector({ formats });
        }

        function buildBarcodeVideoUI() {
            const mount = document.getElementById('barcode-reader');
            if (!mount) return;

            mount.innerHTML = '';

            barcodeVideoEl = document.createElement('video');
            barcodeVideoEl.setAttribute('playsinline', 'true');
            barcodeVideoEl.setAttribute('autoplay', 'true');
            barcodeVideoEl.setAttribute('muted', 'true');
            barcodeVideoEl.className = 'w-full h-full object-cover rounded-xl';

            const guide = document.createElement('div');
            guide.className = 'absolute inset-0 pointer-events-none flex items-center justify-center';
            guide.innerHTML = `
                <div class="w-[92%] h-[28%] border-2 border-white/90 rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.18)]"></div>
            `;

            mount.appendChild(barcodeVideoEl);
            mount.appendChild(guide);

            barcodeCanvasEl = document.createElement('canvas');
            barcodeCanvasCtx = barcodeCanvasEl.getContext('2d', { willReadFrequently: true });
        }

        async function startBarcodeDetectLoop() {
            if (!barcodeDetectorInstance) {
                barcodeDetectorInstance = await createBarcodeDetectorInstance();
            }

            clearInterval(barcodeDetectLoopTimer);

            barcodeDetectLoopTimer = setInterval(async () => {
                if (!barcodeScannerRunning || barcodeScannerLocked || !barcodeVideoEl) return;
                if (barcodeVideoEl.readyState < 2) return;

                try {
                    const barcodes = await barcodeDetectorInstance.detect(barcodeVideoEl);
                    if (!barcodes || !barcodes.length) return;

                    const preferred = barcodes.find(item => {
                        const format = String(item.format || '').toLowerCase();
                        return ['ean_13', 'ean_8', 'upc_a', 'upc_e'].includes(format);
                    }) || barcodes[0];

                    handleDetectedBarcodeValue(preferred.rawValue || '');
                } catch (error) {
                    console.warn('Lỗi detect barcode:', error);
                }
            }, 180);
        }

        function handleDetectedBarcodeValue(decodedText) {
            if (barcodeScannerLocked) return;

            const code = normalizeBarcodeText(decodedText);

            if (!code) {
                setBarcodeScanStatus('Chưa đọc được mã, giữ camera ổn định và quét lại...', 'warning');
                return;
            }

            barcodeScannerLocked = true;
            setBarcodeScanStatus('✓ Đã quét được: ' + code, 'success');
            fillBarcodeFromCamera(code);
            setTimeout(() => closeBarcodeScanner(), 350);
        }

        async function openBarcodeScanner() {
            const modal = document.getElementById('modal-barcode-scanner');
            if (!modal) return;

            modal.classList.remove('hidden');
            barcodeScannerLocked = false;
            resetBarcodeScanConfirm();
            setBarcodeScanStatus('Đang mở camera quét mã vạch...');

            if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1' && location.protocol !== 'file:') {
                setBarcodeScanStatus('Trình duyệt chỉ cho quét camera khi web chạy HTTPS hoặc localhost.', 'error');
                return;
            }

            try {
                buildBarcodeVideoUI();
                await ensureBarcodeDetectorSupport();
                barcodeDetectorInstance = await createBarcodeDetectorInstance();

                barcodeScannerStream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        facingMode: { ideal: 'environment' },
                        width: { ideal: 1280 },
                        height: { ideal: 720 }
                    },
                    audio: false
                });

                barcodeVideoEl.srcObject = barcodeScannerStream;
                await barcodeVideoEl.play();

                barcodeScannerRunning = true;
                setBarcodeScanStatus('Camera đã sẵn sàng. Quét được mã sẽ tự điền ngay.');
                await startBarcodeDetectLoop();
            } catch (error) {
                console.error('Lỗi mở barcode-detector:', error);
                setBarcodeScanStatus(error.message || 'Không mở được camera. Hãy cấp quyền Camera rồi thử lại.', 'error');
            }
        }

        async function closeBarcodeScanner() {
            const modal = document.getElementById('modal-barcode-scanner');

            clearInterval(barcodeDetectLoopTimer);
            barcodeDetectLoopTimer = null;

            try {
                if (barcodeVideoEl) {
                    barcodeVideoEl.pause();
                    barcodeVideoEl.srcObject = null;
                }

                if (barcodeScannerStream) {
                    barcodeScannerStream.getTracks().forEach(track => track.stop());
                }
            } catch (error) {
                console.warn('Không dừng được camera barcode:', error);
            }

            barcodeScannerStream = null;
            barcodeScannerRunning = false;
            barcodeScannerLocked = false;
            resetBarcodeScanConfirm();

            if (modal) modal.classList.add('hidden');
        }


        document.getElementById('auto-barcode').oninput = async (e) => {
			const val = e.target.value.trim();
			const statusMsg = document.getElementById('search-status');

			const setSearchStatus = (message, type = 'info') => {
				if (!statusMsg) return;

				statusMsg.innerText = message || '';
				statusMsg.classList.remove(
					'hidden',
					'text-blue-600',
					'text-orange-500',
					'text-slate-400',
					'text-red-500',
					'text-green-600'
				);

				if (!message) {
					statusMsg.classList.add('hidden');
					return;
				}

				if (type === 'success') statusMsg.classList.add('text-blue-600');
				else if (type === 'warning') statusMsg.classList.add('text-orange-500');
				else if (type === 'error') statusMsg.classList.add('text-red-500');
				else statusMsg.classList.add('text-slate-400');
			};

			// Nếu xóa trắng ô barcode thì xóa trắng các ô thông tin
			if (!val) { 
				setSearchStatus('');
				resetDefectFields();
				return; 
			}

			// 1. Tìm nhanh trong catalogData (dữ liệu đã load sẵn)
			let found = catalogData.find(c => String(c.barcode || '').trim() === val);

			// 2. Nếu không thấy trong máy, thử truy vấn trực tiếp từ Supabase
			if (!found && supabaseClient) {
				setSearchStatus("Đang tìm trong danh mục...", 'info');

				const { data, error } = await supabaseClient
					.from('catalog')
					.select('*')
					.eq('barcode', val)
					.single();

				if (data) found = data;
			}

			// 3. Hiển thị kết quả
			if (found) {
				const supplier = normalizeSupplierFields(found);
				document.getElementById('f-product_name').value = found.product_name || '';
				document.getElementById('f-sku').value = found.sku || '';
				document.getElementById('f-vendor_name').value = supplier.vendor_name;
				document.getElementById('f-vendor_id').value = supplier.vendor_id;
				document.getElementById('f-barcode').value = found.barcode || val;

				setSearchStatus("✓ Đã tìm thấy thông tin!", 'success');
			} else {
				setSearchStatus("⚠ Không tìm thấy trong danh mục", 'warning');
				// Không reset fields ở đây để người dùng có thể tự nhập tay nếu là hàng mới
			}
		};


		// Hàm hỗ trợ xóa trắng form
		function resetDefectFields() {
			document.getElementById('f-product_name').value = '';
			document.getElementById('f-sku').value = '';
			document.getElementById('f-vendor_name').value = '';
			document.getElementById('f-vendor_id').value = '';
			document.getElementById('f-barcode').value = '';
		}
		
		function formatDateTime(dateString) {
			if (!dateString) return 'N/A';
			const date = new Date(dateString);
			return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + 
				   ' ' + date.toLocaleDateString('vi-VN');
		}


		function getVisibleRowsForExport(tableName) {
			let rows = getSearchFilteredRows(tableName);
			rows = applyTableFilters(rows, tableName);
			rows = applyTableSort([...rows], tableName);
			return rows;
		}

		function exportDefectsToExcel() {
			const visibleRows = getVisibleRowsForExport('dashboard');

			if (visibleRows.length === 0) {
				window.showToast("Không có dữ liệu phù hợp với bộ lọc hiện tại để xuất!");
				return;
			}

			// Xuất đúng dữ liệu đang hiển thị sau khi tìm kiếm + lọc tiêu đề giống Excel
			const dataToExport = visibleRows.map(d => ({
				"Thời gian": new Date(d.created_at).toLocaleString('vi-VN'),
				"Barcode": d.barcode || '',
				"Tên sản phẩm": d.product_name || '',
				"Số lượng": d.quantity || 1,
				"Item": d.sku || '',
				"Mã NCC": d.vendor_id || '',
				"Tên NCC": d.vendor_name || '',
				"Loại lỗi": d.defect_type || '',
				"Mức độ": d.severity || '',
				"Trạng thái": d.status === 'Pending' ? 'Chờ xử lý' : (d.status === 'Fixing' ? 'Đang sửa' : 'Xong'),
				"Link hình ảnh": getDefectImageUrls(d).join("\n")
			}));

			// 2. Tạo Workbook và Worksheet
			const worksheet = XLSX.utils.json_to_sheet(dataToExport);
			const workbook = XLSX.utils.book_new();
			XLSX.utils.book_append_sheet(workbook, worksheet, "Danh sách hàng lỗi");

			// 3. Tự động căn chỉnh độ rộng cột (tùy chọn)
			const wscols = [
				{wch: 20}, {wch: 15}, {wch: 30}, {wch: 15}, 
				{wch: 10}, {wch: 25}, {wch: 20}, {wch: 10}, 
				{wch: 15}, {wch: 40}
			];
			worksheet['!cols'] = wscols;

			// 4. Xuất file với tên file có ngày tháng
			const today = new Date().toISOString().slice(0, 10);
			XLSX.writeFile(workbook, `Bao_Cao_Loi_${today}.xlsx`);
		}

		function exportHistoryToExcel() {
			const historyData = getVisibleRowsForExport('history');

			if (historyData.length === 0) {
				window.showToast("Không có dữ liệu lịch sử phù hợp với bộ lọc hiện tại để xuất!");
				return;
			}

			const dataToExport = historyData.map(d => ({
				"Thời gian": new Date(d.created_at).toLocaleString('vi-VN'),
				"Barcode": d.barcode || '',
				"Tên sản phẩm": d.product_name || '',
				"Số lượng": d.quantity || 1,
				"Item": d.sku || '',
				"Mã NCC": d.vendor_id || '',
				"Tên NCC": d.vendor_name || '',
				"Loại lỗi": d.defect_type || '',
				"Mức độ": d.severity || '',
				"Trạng thái": "Xong",
				"Link hình ảnh": getDefectImageUrls(d).join("\n")
			}));

			const worksheet = XLSX.utils.json_to_sheet(dataToExport);
			const workbook = XLSX.utils.book_new();
			XLSX.utils.book_append_sheet(workbook, worksheet, "Lịch sử hàng lỗi");

			const today = new Date().toISOString().slice(0, 10);
			XLSX.writeFile(workbook, `Lich_Su_Hang_Loi_${today}.xlsx`);
		}

		async function loginApp() {
			const mode = document.getElementById('login-mode').value;
			const username = document.getElementById('login-user').value.trim();
			const password = document.getElementById('login-pass').value.trim();

			document.getElementById('login-error').classList.add('hidden');

			if (!username || !password) {
				document.getElementById('login-error').innerText = 'Vui lòng nhập tài khoản và mật khẩu';
				document.getElementById('login-error').classList.remove('hidden');
				return;
			}

			showAppLoading('Đang đăng nhập...', 'Đang kiểm tra tài khoản và phân quyền');

			try {
				if (mode === 'auth') {
					const { data, error } = await supabaseClient.auth.signInWithPassword({
						email: username,
						password
					});

					if (error) {
						document.getElementById('login-error').innerText = error.message;
						document.getElementById('login-error').classList.remove('hidden');
						return;
					}

					currentUser = data.user;
					await loadUserRole();
					currentDisplayName = data.user.email || 'Quản trị';
					updateHelloUser();
					localStorage.setItem('loginMode', 'auth');
				}

				if (mode === 'app_user') {
					const { data, error } = await supabaseClient.rpc('login_app_user', {
						p_username: username,
						p_password: password
					});

					if (error || !data || data.length === 0) {
						document.getElementById('login-error').innerText = 'Sai tài khoản hoặc mật khẩu';
						document.getElementById('login-error').classList.remove('hidden');
						return;
					}

					const user = data[0];
					currentUser = user;
					currentRole = user.role || 'staff';
					currentDisplayName = user.full_name || user.username || 'Nhân viên';
					updateHelloUser();
					localStorage.setItem('loginMode', 'app_user');
					localStorage.setItem('appUser', JSON.stringify(user));
				}

				updateAppLoading('Đang mở giao diện...', 'Đang tải dữ liệu theo quyền tài khoản');
				document.getElementById('login-screen').classList.add('hidden');
				applyPermissionUI();
				await fetchUsers();
				if (isAdmin()) await fetchActivityLogs();
				await refreshNotificationsAfterLogin();
				await createActivityLog('login', 'session', null, `${currentDisplayName} đăng nhập hệ thống`, { mode, username });
				renderDashboard();
				renderHistory();
			} finally {
				hideAppLoading(true);
			}
		}

		async function logoutApp() {
			stopAutoRefresh();
			const mode = localStorage.getItem('loginMode');

			await createActivityLog('logout', 'session', null, `${currentDisplayName || 'Người dùng'} đăng xuất hệ thống`, { mode });

			if (mode === 'auth') {
				await supabaseClient.auth.signOut();
			}

			localStorage.removeItem('loginMode');
			localStorage.removeItem('appUser');

			clearPwaAppBadge();

			location.reload();
		}

		async function loadUserRole() {
			if (!currentUser) return;

			// Tài khoản đăng nhập bằng Supabase Auth là tài khoản quản trị.
			// Nếu bảng profiles chưa có dòng role cho user này thì vẫn cho quyền admin,
			// tránh bị mặc định staff làm ẩn tab quản trị/thông báo.
			currentRole = 'admin';

			try {
				const { data, error } = await supabaseClient
					.from('profiles')
					.select('role')
					.eq('id', currentUser.id)
					.maybeSingle();

				if (!error && data && data.role) {
					currentRole = data.role;
				}
			} catch (error) {
				console.warn('Không đọc được profiles, giữ quyền admin cho tài khoản Auth:', error.message);
			}
		}

		async function checkLogin() {
			showAppLoading('Đang kiểm tra phiên đăng nhập...', 'Đang khôi phục phiên làm việc nếu có');
			try {
				const mode = localStorage.getItem('loginMode');

				if (mode === 'app_user') {
					const savedUser = localStorage.getItem('appUser');

					if (savedUser) {
						currentUser = JSON.parse(savedUser);
						currentRole = currentUser.role || 'staff';
						currentDisplayName = currentUser.full_name || currentUser.username || 'Nhân viên';

						updateHelloUser();
						document.getElementById('login-screen').classList.add('hidden');
						applyPermissionUI();
						await fetchUsers();
						if (isAdmin()) await fetchActivityLogs();
						await refreshNotificationsAfterLogin();
						renderDashboard();
						renderHistory();
						return;
					}
				}

				const { data } = await supabaseClient.auth.getSession();

				if (data.session) {
					currentUser = data.session.user;
					await loadUserRole();
					currentDisplayName = currentUser.email || 'Quản trị';

					updateHelloUser();
					document.getElementById('login-screen').classList.add('hidden');
					applyPermissionUI();
					await fetchUsers();
					if (isAdmin()) await fetchActivityLogs();
					await refreshNotificationsAfterLogin();
					renderDashboard();
					renderHistory();
				} else {
					document.getElementById('login-screen').classList.remove('hidden');
				}
			} finally {
				hideAppLoading(true);
			}
		}

		function getStatusText(status) {
			if (status === 'Pending') return 'Chờ xử lý';
			if (status === 'Fixing') return 'Đang sửa';
			if (status === 'Resolved') return 'Xong';
			return 'Chờ xử lý';
		}

		function openStatusModal(id) {

			const defect = defectsData.find(d => d.id == id);

			if (!defect) return;

			document.getElementById('status-defect-id').value = id;

			document.getElementById('status-product-name').innerText =
				defect.product_name || 'N/A';

			document.getElementById('status-sku').innerText =
				defect.sku || '-';

			document.getElementById('status-barcode').innerText =
				defect.barcode || '-';

			document.getElementById('status-date').innerText =
				formatDateTime(defect.created_at);

			toggleModal('modal-status', true);
		}

		async function saveStatus(status) {
			const id = document.getElementById('status-defect-id').value;

			if (!id) return;

			const currentDefect = defectsData.find(d => d.id == id) || {};

			const { data: updatedDefect, error } = await supabaseClient
				.from('defects')
				.update({ status })
				.eq('id', id)
				.select()
				.single();

			if (error) {
				window.showToast("Lỗi cập nhật trạng thái: " + error.message);
				return;
			}

			await createActivityLog('update', 'defects', id, `Cập nhật trạng thái hàng lỗi: ${updatedDefect?.product_name || currentDefect.product_name || '-'}`, { old_status: currentDefect.status, new_status: status, sku: updatedDefect?.sku || currentDefect.sku, barcode: updatedDefect?.barcode || currentDefect.barcode });

			if (currentDefect.status !== status) {
				const notificationType = status === 'Fixing'
					? 'defect_fixing'
					: status === 'Resolved'
						? 'defect_resolved'
						: 'defect_status_updated';

				await createNotification(notificationType, updatedDefect || currentDefect, { status });
			}

			window.showToast(`Đã cập nhật trạng thái: ${getStatusText(status)}`, 'success');
			toggleModal('modal-status', false);
			await fetchDefects();
		}

		function downloadDefectSampleExcel() {
			const data = [{
				"Barcode": "2110706100077",
				"Tên sản phẩm": "GẤU ĐỨNG TIM LỚN",
				"Item": "100164",
				"Tên NCC": "Tên nhà cung cấp mẫu",
				"Mã NCC": "NCC001",
				"Mô tả lỗi": "Rách bao bì",
				"Số lượng": 1,
				"Mức độ": "Medium",
				"Trạng thái": "Pending"
			}];

			const ws = XLSX.utils.json_to_sheet(data);
			const wb = XLSX.utils.book_new();

			XLSX.utils.book_append_sheet(wb, ws, "Bao cao loi");
			XLSX.writeFile(wb, "Mau_Nhap_Bao_Cao_Loi.xlsx");
		}

		function applyPermissionUI() {
			document.querySelectorAll('.admin-po-only').forEach(el => {
				el.classList.toggle('hidden', !canManageData());
			});

			document.querySelectorAll('.admin-only').forEach(el => {
				el.classList.toggle('hidden', !isAdmin());
			});

			if (!canManageData()) {
				document.getElementById('view-catalog').classList.add('hidden');
				document.getElementById('view-dashboard').classList.remove('hidden');
			}
		}

		function renderUsers() {

			const query = (usersSearch?.value || '').toLowerCase().trim();

			let filteredUsers = appUsers.filter(u => {
				const searchStr = `${u.username || ''} ${u.full_name || ''} ${u.role || ''} ${u.active ? 'hoạt động active' : 'đã khóa inactive'}`.toLowerCase();
				return searchStr.includes(query);
			});

			filteredUsers = applyTableSort(filteredUsers, 'users');
			updateSortIndicators('users');

			usersList.innerHTML = filteredUsers.map(u => `

				<tr class="hover:bg-slate-50">

					<td class="px-6 py-4 font-semibold">
						${u.username}
					</td>

					<td class="px-6 py-4">
						${u.full_name || '-'}
					</td>

					<td class="px-6 py-4">

						<span class="px-2 py-1 rounded-full text-xs font-bold
							${u.role === 'admin'
								? 'bg-red-100 text-red-700'
								: u.role === 'po'
									? 'bg-blue-100 text-blue-700'
									: 'bg-slate-100 text-slate-700'}">

							${u.role}
						</span>

					</td>

					<td class="px-6 py-4">

						<span class="px-2 py-1 rounded-full text-xs font-bold
							${u.active
								? 'bg-green-100 text-green-700'
								: 'bg-red-100 text-red-700'}">

							${u.active ? 'Hoạt động' : 'Đã khóa'}
						</span>

					</td>

					<td class="px-6 py-4 text-sm text-slate-500">
						${formatDateTime(u.created_at)}
					</td>

					<td class="px-6 py-4 text-right">

						<div class="flex justify-end gap-2">

							<button onclick="toggleUserStatus('${u.id}', ${u.active})"
								class="px-3 py-1 rounded-lg text-sm
								${u.active
									? 'bg-yellow-100 text-yellow-700'
									: 'bg-green-100 text-green-700'}">

								${u.active ? 'Khóa' : 'Mở'}
							</button>

							<button onclick="openEditUserModal('${u.id}')"
								class="px-3 py-1 rounded-lg bg-blue-100 text-blue-700 text-sm ml-2">
								Sửa
							</button>

							<button onclick="deleteUser('${u.id}')"
								class="px-3 py-1 rounded-lg bg-red-100 text-red-700 text-sm">

								Xóa
							</button>

						</div>

					</td>

				</tr>

			`).join('');
			
			usersMobileList.innerHTML = filteredUsers.map(u => `
				<div class="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">

					<div class="flex items-start justify-between gap-3">
						<div>
							<div class="font-bold text-slate-800 text-lg">
								${u.full_name || '-'}
							</div>

							<div class="text-sm text-slate-500 mt-1">
								@${u.username}
							</div>
						</div>

						<span class="px-2 py-1 rounded-full text-xs font-bold ${
							u.role === 'admin'
								? 'bg-red-100 text-red-700'
								: u.role === 'po'
									? 'bg-blue-100 text-blue-700'
									: 'bg-slate-100 text-slate-700'
						}">
							${u.role}
						</span>
					</div>

					<div class="mt-3 grid grid-cols-2 gap-2 text-xs">
						<div class="bg-slate-50 rounded-xl p-2">
							<div class="text-slate-400">Trạng thái</div>
							<div class="font-bold ${u.active ? 'text-green-600' : 'text-red-600'}">
								${u.active ? 'Hoạt động' : 'Đã khóa'}
							</div>
						</div>

						<div class="bg-slate-50 rounded-xl p-2">
							<div class="text-slate-400">Ngày tạo</div>
							<div class="font-semibold text-slate-700">
								${formatDateTime(u.created_at)}
							</div>
						</div>
					</div>

					<div class="mt-4 grid grid-cols-3 gap-2">
						<button onclick="openEditUserModal('${u.id}')"
							class="py-2 rounded-xl bg-blue-50 text-blue-700 font-bold text-sm">
							Sửa
						</button>

						<button onclick="toggleUserStatus('${u.id}', ${u.active})"
							class="py-2 rounded-xl font-bold text-sm ${
								u.active
									? 'bg-yellow-50 text-yellow-700'
									: 'bg-green-50 text-green-700'
							}">
							${u.active ? 'Khóa' : 'Mở'}
						</button>

						<button onclick="deleteUser('${u.id}')"
							class="py-2 rounded-xl bg-red-50 text-red-700 font-bold text-sm">
							Xóa
						</button>
					</div>

				</div>
			`).join('');
		}



        function getPasswordFormElements(prefix) {
            return {
                currentPassEl: document.getElementById(prefix + '-current-password'),
                newPassEl: document.getElementById(prefix + '-new-password'),
                confirmPassEl: document.getElementById(prefix + '-confirm-password'),
                submitBtn: document.getElementById(prefix + '-password-submit'),
                messageEl: document.getElementById(prefix + '-password-message')
            };
        }

        function setPasswordMessage(prefix, message, type = 'info') {
            const el = document.getElementById(prefix + '-password-message');
            if (!el) return;

            el.innerText = message || '';
            el.classList.toggle('hidden', !message);
            el.classList.remove('text-red-600', 'text-green-600', 'text-slate-500');

            if (type === 'success') el.classList.add('text-green-600');
            else if (type === 'error') el.classList.add('text-red-600');
            else el.classList.add('text-slate-500');
        }

        function setPersonalPasswordMessage(message, type = 'info') {
            setPasswordMessage('popup', message, type);
        }

        function openPasswordPopup() {
            const modal = document.getElementById('modal-password-change');
            if (!modal) return;

            setPasswordMessage('popup', '');
            ['popup-current-password', 'popup-new-password', 'popup-confirm-password'].forEach(id => {
                const input = document.getElementById(id);
                if (input) input.value = '';
            });

            modal.classList.remove('hidden');
            document.body.classList.add('modal-open');
            setTimeout(() => document.getElementById('popup-current-password')?.focus(), 80);
        }

        function closePasswordPopup() {
            const modal = document.getElementById('modal-password-change');
            if (!modal) return;

            modal.classList.add('hidden');
            document.body.classList.remove('modal-open');
            setPasswordMessage('popup', '');

            ['popup-current-password', 'popup-new-password', 'popup-confirm-password'].forEach(id => {
                const input = document.getElementById(id);
                if (input) input.value = '';
            });
        }

        async function changePersonalPassword(event) {
            event.preventDefault();

            const prefix = 'popup';
            const { currentPassEl, newPassEl, confirmPassEl, submitBtn } = getPasswordFormElements(prefix);

            const currentPassword = currentPassEl?.value.trim() || '';
            const newPassword = newPassEl?.value.trim() || '';
            const confirmPassword = confirmPassEl?.value.trim() || '';

            setPasswordMessage(prefix, '');

            if (!currentPassword || !newPassword || !confirmPassword) {
                setPasswordMessage(prefix, 'Vui lòng nhập đầy đủ mật khẩu hiện tại, mật khẩu mới và xác nhận mật khẩu.', 'error');
                return;
            }

            if (newPassword.length < 6) {
                setPasswordMessage(prefix, 'Mật khẩu mới nên có ít nhất 6 ký tự.', 'error');
                return;
            }

            if (newPassword !== confirmPassword) {
                setPasswordMessage(prefix, 'Mật khẩu mới và nhập lại mật khẩu không khớp.', 'error');
                return;
            }

            if (currentPassword === newPassword) {
                setPasswordMessage(prefix, 'Mật khẩu mới phải khác mật khẩu hiện tại.', 'error');
                return;
            }

            const oldBtnHtml = submitBtn ? submitBtn.innerHTML : '';
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang lưu...';
            }

            try {
                const mode = localStorage.getItem('loginMode');

                if (mode === 'auth') {
                    const email = currentUser?.email;

                    if (!email) {
                        throw new Error('Không tìm thấy email tài khoản quản trị.');
                    }

                    const { error: verifyError } = await supabaseClient.auth.signInWithPassword({
                        email,
                        password: currentPassword
                    });

                    if (verifyError) {
                        throw new Error('Mật khẩu hiện tại không đúng.');
                    }

                    const { error: updateError } = await supabaseClient.auth.updateUser({
                        password: newPassword
                    });

                    if (updateError) throw updateError;
                } else {
                    const username = currentUser?.username;

                    if (!username) {
                        throw new Error('Không tìm thấy tài khoản người dùng.');
                    }

                    const { error } = await supabaseClient.rpc('change_app_user_password', {
                        p_username: username,
                        p_current_password: currentPassword,
                        p_new_password: newPassword
                    });

                    if (error) {
                        if ((error.message || '').toLowerCase().includes('function') || (error.message || '').toLowerCase().includes('schema cache')) {
                            throw new Error('Chưa có hàm Supabase change_app_user_password. Cần tạo RPC đổi mật khẩu cho bảng app_users.');
                        }
                        throw error;
                    }
                }

                await createActivityLog('update', 'account', currentUser?.id || currentUser?.username || null, `${currentDisplayName || 'Người dùng'} đổi mật khẩu cá nhân`, { mode });

                setPasswordMessage(prefix, 'Đổi mật khẩu thành công.', 'success');
                setTimeout(() => closePasswordPopup(), 900);
            } catch (error) {
                setPasswordMessage(prefix, error.message || 'Không đổi được mật khẩu. Vui lòng thử lại.', 'error');
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = oldBtnHtml;
                }
            }
        }


		document.getElementById('user-form').onsubmit = async (e) => {

			e.preventDefault();

			const formData = Object.fromEntries(new FormData(e.target));

			const { error } = await supabaseClient.rpc(
				'create_app_user',
				{
					p_username: formData.username,
					p_password: formData.password,
					p_full_name: formData.full_name,
					p_role: formData.role
				}
			);

			if (error) {
				window.showToast(error.message);
				return;
			}

			window.showToast("Đã tạo tài khoản!");

			toggleModal('modal-user', false);

			e.target.reset();

			await fetchUsers();
		};

        enhanceExcelFilters();
        init();
		document.body.classList.add('active-tab-dashboard');
		checkLogin();
    

        function scrollToTop() {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        }

        function updateScrollTopButton() {
            const btn = document.getElementById('scroll-top-btn');
            if (!btn) return;

            if (window.scrollY > 260) {
                btn.classList.add('show');
            } else {
                btn.classList.remove('show');
            }
        }

        window.addEventListener('scroll', updateScrollTopButton, { passive: true });
        window.addEventListener('load', updateScrollTopButton);

    
        
        function updateBodyRoleClass() {
            document.body.classList.remove('role-admin', 'role-po', 'role-staff', 'role-user');
            const role = currentRole || 'staff';
            document.body.classList.add('role-' + role);
        }


        function switchAccountSubTab(tab) {
            if (currentRole !== 'admin' && tab === 'manage') tab = 'personal';
            const manageBtn = document.getElementById('account-subtab-manage');
            const personalBtn = document.getElementById('account-subtab-personal');
            const manageView = document.getElementById('users-management-subview');
            const personalView = document.getElementById('account-personal-subview');

            if (!manageBtn || !personalBtn || !manageView || !personalView) return;

            const isPersonal = tab === 'personal';

            manageBtn.classList.toggle('active', !isPersonal);
            personalBtn.classList.toggle('active', isPersonal);

            manageView.classList.toggle('hidden', isPersonal);
            personalView.classList.toggle('hidden', !isPersonal);

            if (isPersonal) {
                updateMobilePersonalAccount();
            }
        }

        function updateMobilePersonalAccount() {
            const nameEl = document.getElementById('mobile-personal-name');
            const roleEl = document.getElementById('mobile-personal-role');
            const usernameEl = document.getElementById('mobile-personal-username');
            setPersonalPasswordMessage('');

            const displayName = currentDisplayName || currentUser?.full_name || currentUser?.username || 'Người dùng';
            const username = currentUser?.email || currentUser?.username || currentDisplayName || '-';

            if (nameEl) nameEl.innerText = displayName;
            if (usernameEl) usernameEl.innerText = username;

            if (roleEl) {
                const roleMap = {
                    admin: 'Quản trị viên',
                    po: 'PO',
                    staff: 'Nhân viên'
                };
                roleEl.innerText = roleMap[currentRole] || currentRole || 'Nhân viên';
            }
            updateBodyRoleClass();

            if (currentRole !== 'admin') {
                const manageBtn = document.getElementById('account-subtab-manage');
                const personalBtn = document.getElementById('account-subtab-personal');
                const manageView = document.getElementById('users-management-subview');
                const personalView = document.getElementById('account-personal-subview');

                if (manageBtn) manageBtn.classList.remove('active');
                if (personalBtn) personalBtn.classList.add('active');
                if (manageView) manageView.classList.add('hidden');
                if (personalView) personalView.classList.remove('hidden');
            }

        }


		
        // Mobile: chặn pull-to-refresh và vuốt trái/phải để chuyển tab kế bên
        (function setupMobileSwipeTabsAndPullGuard() {
            if (window.__mobileSwipeTabsAndPullGuardReady) return;
            window.__mobileSwipeTabsAndPullGuardReady = true;

            const allMobileTabs = ['dashboard', 'history', 'catalog', 'users', 'logs'];
            let startX = 0;
            let startY = 0;
            let startTime = 0;
            let maybePullingDown = false;

            function isMobileViewport() {
                return window.matchMedia('(max-width: 768px)').matches;
            }

            function isInteractiveTarget(target) {
                return !!target.closest(
                    'input, textarea, select, button, a, label, [contenteditable="true"], ' +
                    '#modal-image, #modal-defect, #modal-catalog, #modal-barcode-scanner, #modal-password-change, ' +
                    '.excel-filter-menu, .bottom-tab-bar'
                );
            }

            function getCurrentMobileTab() {
                const activeBodyClass = [...document.body.classList].find(cls => cls.startsWith('active-tab-'));
                if (activeBodyClass) {
                    const tab = activeBodyClass.replace('active-tab-', '');
                    if (allMobileTabs.includes(tab)) return tab;
                }

                const activeView = document.querySelector('.view:not(.hidden)');
                if (activeView && activeView.id) {
                    return activeView.id.replace('view-', '');
                }

                return 'dashboard';
            }

            function goToAdjacentTab(direction) {
                const current = getCurrentMobileTab();
                const availableTabs = (typeof getAllowedTabs === 'function')
                    ? getAllowedTabs().filter(tab => allMobileTabs.includes(tab))
                    : allMobileTabs.filter(tab => {
                        if (tab === 'catalog') return typeof canManageData === 'function' && canManageData();
                        if (tab === 'logs') return typeof isAdmin === 'function' && isAdmin();
                        return true;
                    });

                const index = availableTabs.indexOf(current);
                if (index === -1) return;

                const nextIndex = index + direction;
                if (nextIndex < 0 || nextIndex >= availableTabs.length) return;

                if (typeof window.switchTab === 'function') {
                    window.switchTab(availableTabs[nextIndex], { silent: true });
                }
            }

            document.addEventListener('touchstart', function(e) {
                if (!isMobileViewport() || e.touches.length !== 1) return;

                const touch = e.touches[0];
                startX = touch.clientX;
                startY = touch.clientY;
                startTime = Date.now();
                maybePullingDown = window.scrollY <= 0 && startY < 90;
            }, { passive: true });

            document.addEventListener('touchmove', function(e) {
                if (!isMobileViewport() || e.touches.length !== 1) return;

                const touch = e.touches[0];
                const deltaY = touch.clientY - startY;
                const deltaX = touch.clientX - startX;

                // Chặn kéo xuống ở đầu trang để tránh browser refresh.
                if (maybePullingDown && window.scrollY <= 0 && deltaY > 8 && Math.abs(deltaY) > Math.abs(deltaX)) {
                    e.preventDefault();
                }
            }, { passive: false });

            document.addEventListener('touchend', function(e) {
                if (!isMobileViewport()) return;
                if (!startTime) return;

                const target = e.target;
                if (isInteractiveTarget(target)) return;

                const touch = e.changedTouches && e.changedTouches[0];
                if (!touch) return;

                const deltaX = touch.clientX - startX;
                const deltaY = touch.clientY - startY;
                const elapsed = Date.now() - startTime;

                startTime = 0;

                // Vuốt ngang đủ dài, không quá chéo, không quá chậm.
                if (elapsed > 650) return;
                if (Math.abs(deltaX) < 70) return;
                if (Math.abs(deltaX) < Math.abs(deltaY) * 1.35) return;

                if (deltaX < 0) {
                    // Vuốt trái: sang tab kế bên bên phải.
                    goToAdjacentTab(1);
                } else {
                    // Vuốt phải: về tab kế bên bên trái.
                    goToAdjacentTab(-1);
                }
            }, { passive: true });
        })();




        // Mobile: kéo xuống ẩn header, kéo lên hiện lại
        (function setupMobileHideHeaderOnScroll() {
            if (window.__mobileHideHeaderOnScrollReady) return;
            window.__mobileHideHeaderOnScrollReady = true;

            let lastY = window.pageYOffset || document.documentElement.scrollTop || 0;
            let ticking = false;

            function isMobileViewport() {
                return window.matchMedia('(max-width: 768px)').matches;
            }

            function shouldKeepHeaderVisible() {
                return document.body.classList.contains('modal-open') ||
                    document.body.classList.contains('image-modal-open') ||
                    !document.getElementById('login-screen')?.classList.contains('hidden');
            }

            function updateHeaderByScroll() {
                ticking = false;

                if (!isMobileViewport() || shouldKeepHeaderVisible()) {
                    document.body.classList.remove('mobile-header-hidden');
                    lastY = window.pageYOffset || document.documentElement.scrollTop || 0;
                    return;
                }

                const currentY = Math.max(0, window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0);
                const diff = currentY - lastY;

                // Ở gần đầu trang thì luôn hiện header.
                if (currentY < 24) {
                    document.body.classList.remove('mobile-header-hidden');
                } else if (diff > 4) {
                    // Cuộn/kéo xuống: ẩn header.
                    document.body.classList.add('mobile-header-hidden');
                } else if (diff < -4) {
                    // Cuộn/kéo lên: hiện header.
                    document.body.classList.remove('mobile-header-hidden');
                }

                lastY = currentY;
            }

            function requestUpdate() {
                if (ticking) return;
                ticking = true;
                requestAnimationFrame(updateHeaderByScroll);
            }

            window.addEventListener('scroll', requestUpdate, { passive: true });
            document.addEventListener('touchmove', requestUpdate, { passive: true });
            window.addEventListener('resize', requestUpdate, { passive: true });
            document.addEventListener('DOMContentLoaded', requestUpdate);
        })();
