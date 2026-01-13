/**
 * PRIORITY ELITE ULTRA - CORE ENGINE
 * Performance Optimized Vanilla JS */

// --- ELITE ERROR REPORTING ---
window.onerror = (msg, url, line) => {
    if (typeof ui !== 'undefined' && ui.showToast) {
        ui.showToast(`Elite Engine Alert: ${msg} (Linha ${line})`, 'danger');
    }
    console.error('Core Error:', msg, 'at', url, ':', line);
    return false;
};

// --- GLOBAL STATE ---
const state = {
    user: JSON.parse(localStorage.getItem('currentUser')),
    todos: [], // Will be loaded per user
    currentView: 'tasks',
    filter: 'all',
    searchQuery: '',
    zenMode: false,
    pomo: { time: 25 * 60, running: false, interval: null },
    charts: { completion: null, categories: null },
    authMode: 'login'
};

// --- INITIALIZATION ---
const init = () => {
    if (window.lucide) lucide.createIcons();
    ui.setup();

    if (state.user) {
        // --- ELITE STATE PROTECTION ---
        if (state.user.xp === undefined || isNaN(state.user.xp)) state.user.xp = 0;
        if (state.user.level === undefined || isNaN(state.user.level)) state.user.level = 1;
        if (state.user.streak === undefined || isNaN(state.user.streak)) state.user.streak = 0;

        todo.load();
        navigation.showView('dashboard');
        navigation.setView('tasks');
        todo.render();
        stats.update();
        // Pomodoro module removed to favor Account Management
        ui.applyUserTheme();
        gamification.init();

        // Update Profile Header Avatar
        if (state.user.picture) {
            document.getElementById('user-avatar').src = state.user.picture;
        }
    } else {
        navigation.showView('auth');
    }

    ui.loadSounds();
    auth.initGoogleSignIn();

    // Set minimum date to today for due date picker
    const dateInput = document.getElementById('new-todo-date');
    if (dateInput) {
        const today = new Date().toISOString().split('T')[0];
        dateInput.setAttribute('min', today);
    }

    // Initialize notifications
    notifications.init();
};

// --- NOTIFICATIONS MODULE ---
const notifications = {
    permission: false,

    init: () => {
        if (!("Notification" in window)) {
            console.warn("Browser doesn't support notifications");
            return;
        }

        // Request permission if not already granted
        if (Notification.permission === "granted") {
            notifications.permission = true;
            notifications.scheduleChecks();
        } else if (Notification.permission !== "denied") {
            Notification.requestPermission().then(permission => {
                notifications.permission = (permission === "granted");
                if (notifications.permission) {
                    notifications.scheduleChecks();
                    ui.showToast('✅ Notificações ativadas!', 'success');
                }
            });
        }
    },

    send: (title, body, icon = '🔔') => {
        if (!notifications.permission) return;

        new Notification(title, {
            body: body,
            icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y="75" font-size="75">' + icon + '</text></svg>',
            badge: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y="75" font-size="75">⚡</text></svg>'
        });
    },

    scheduleChecks: () => {
        // Check deadlines every 15 minutes
        setInterval(() => notifications.checkDeadlines(), 15 * 60 * 1000);

        // Check daily streak at 23:00
        notifications.scheduleDailyReminder();

        // Initial check
        notifications.checkDeadlines();
    },

    checkDeadlines: () => {
        if (!state.todos) return;

        const now = new Date();
        const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

        state.todos.forEach(task => {
            if (task.completed || !task.dueDate) return;

            const dueDate = new Date(task.dueDate);

            // Notify if due within 1 hour
            if (dueDate > now && dueDate <= oneHourFromNow && !task.notified) {
                notifications.send(
                    '⏰ Tarefa Urgente!',
                    `"${task.text}" expira em menos de 1 hora!`,
                    '⚠️'
                );
                task.notified = true; // Prevent duplicate notifications
                todo.save();
            }
        });
    },

    scheduleDailyReminder: () => {
        const now = new Date();
        const tonight = new Date();
        tonight.setHours(23, 0, 0, 0);

        if (now > tonight) {
            tonight.setDate(tonight.getDate() + 1);
        }

        const timeUntilReminder = tonight - now;

        setTimeout(() => {
            const completedToday = state.todos.some(t => {
                const completedDate = new Date(t.completedAt || 0).toDateString();
                return completedDate === new Date().toDateString();
            });

            if (!completedToday) {
                notifications.send(
                    '🔥 Mantém o Streak!',
                    'Completa pelo menos 1 tarefa antes da meia-noite!',
                    '🔥'
                );
            }

            // Reschedule for tomorrow
            notifications.scheduleDailyReminder();
        }, timeUntilReminder);
    },

    onLevelUp: (newLevel) => {
        notifications.send(
            '🎉 LEVEL UP!',
            `Atingiste o Nível ${newLevel}. Continua assim, Comandante!`,
            '🏆'
        );
    }
};

// --- AUTH MODULE ---
const auth = {
    initGoogleSignIn: () => {
        // Official Google Initialization
        const CLIENT_ID = '932147363651-vmoig8eokv57nd60omktt66k91m9s36t.apps.googleusercontent.com';

        if (!window.google) {
            console.error('Google Sign-In script not loaded.');
            setTimeout(() => {
                if (typeof ui !== 'undefined' && ui.showToast) {
                    ui.showToast('Erro: Script do Google não carregado. Verifica a tua ligação.', 'danger');
                }
            }, 2000);
            return;
        }

        try {
            // Check protocol first and warn user
            if (window.location.protocol === 'file:') {
                console.warn('Google Sign-In will not work on file:// protocol.');
                setTimeout(() => {
                    ui.showToast('AVISO: Abre o ficheiro num servidor (ex: Live Server). O Google não permite file://', 'warning');
                }, 3000);
            }

            google.accounts.id.initialize({
                client_id: CLIENT_ID,
                callback: auth.handleGoogleResponse,
                auto_select: false,
                context: 'signin',
                itp_support: true // Improved tracking protection support
            });

            google.accounts.id.renderButton(
                document.getElementById('google-login-btn'),
                {
                    theme: 'outline',
                    size: 'large',
                    width: '320',
                    shape: 'pill',
                    text: 'signin_with',
                    logo_alignment: 'left'
                }
            );

            console.log('Google Sign-In initialized.');
        } catch (error) {
            console.error('Google Sign-In initialization error:', error);
            if (typeof ui !== 'undefined' && ui.showToast) {
                ui.showToast(`Erro Crítico Google: ${error.message}`, 'danger');
            }
        }
    },

    handleGoogleResponse: (response) => {
        const payload = auth.decodeJwt(response.credential);

        const googleUser = {
            id: payload.sub,
            name: payload.name,
            email: payload.email,
            picture: payload.picture,
            streak: 1,
            lastLogin: new Date().toISOString().split('T')[0]
        };

        state.user = googleUser;
        localStorage.setItem('currentUser', JSON.stringify(googleUser));

        ui.showToast(`Autenticado como ${payload.given_name}. Bem-vindo de volta!`, 'success');
        confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
        ui.playSound('success');

        navigation.showView('dashboard');
        todo.render();
        stats.update();
        gamification.init();
    },

    decodeJwt: (token) => {
        try {
            const base64Url = token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            }).join(''));
            return JSON.parse(jsonPayload);
        } catch (e) {
            console.error('JWT Decode error', e);
            return {};
        }
    },

    handleLocalAuth: () => {
        const email = document.getElementById('auth-email').value.trim();
        const password = document.getElementById('auth-password').value;
        const name = document.getElementById('auth-name').value.trim();
        const confirmPass = document.getElementById('auth-password-confirm').value;

        if (!email.includes('@')) return ui.showToast('Email inválido.', 'danger');
        if (password.length < 4) return ui.showToast('A palavra-passe deve ter pelo menos 4 caracteres.', 'warning');

        let users = JSON.parse(localStorage.getItem('elite_local_users')) || [];

        if (state.authMode === 'signup') {
            if (!name) return ui.showToast('Introduz o teu nome.', 'warning');
            if (password !== confirmPass) return ui.showToast('As palavras-passe não coincidem.', 'danger');
            if (users.find(u => u.email === email)) return ui.showToast('Este email já está registado.', 'danger');

            const newUser = {
                id: 'local_' + Date.now(),
                name,
                email,
                password, // In a real app, this would be hashed
                picture: `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`,
                streak: 1,
                lastLogin: new Date().toISOString().split('T')[0]
            };

            users.push(newUser);
            localStorage.setItem('elite_local_users', JSON.stringify(users));
            ui.showToast('Conta Elite criada com sucesso! A iniciar sessão...', 'success');

            state.user = newUser;
        } else {
            // Login Mode
            const user = users.find(u => u.email === email && u.password === password);
            if (!user) return ui.showToast('Credenciais inválidas ou conta inexistente.', 'danger');

            state.user = user;
            ui.showToast(`Bem-vindo de volta, ${user.name}!`, 'success');
        }

        localStorage.setItem('currentUser', JSON.stringify(state.user));
        navigation.showView('dashboard');
        todo.load();
        todo.render();
        stats.update();
        gamification.init();
        ui.applyUserTheme();
        confetti({ particleCount: 150, spread: 70 });
    },

    logout: () => {
        localStorage.removeItem('currentUser');
        state.user = null;
        location.reload();
    },

    updateProfile: () => {
        const newName = document.getElementById('edit-name').value.trim();
        const newPass = document.getElementById('edit-password').value;
        const confirmPass = document.getElementById('edit-password-confirm').value;

        if (!newName) return ui.showToast('Introduz um nome válido.', 'danger');

        if (newPass) {
            if (newPass.length < 6) return ui.showToast('A palavra-passe deve ter pelo menos 6 caracteres.', 'warning');
            if (newPass !== confirmPass) return ui.showToast('As palavras-passe não coincidem.', 'danger');
            state.user.password = newPass;
            ui.showToast('Chave de segurança atualizada.', 'success');
        }

        state.user.name = newName;
        state.user.picture = document.getElementById('settings-avatar').src;

        localStorage.setItem('currentUser', JSON.stringify(state.user));

        document.getElementById('user-greeting').innerText = `Bem-vindo, ${state.user.name} 👋`;
        document.getElementById('user-avatar').src = state.user.picture;

        ui.showToast('Perfil Elite atualizado.', 'success');
        ui.playSound('success');

        document.getElementById('edit-password').value = '';
        document.getElementById('edit-password-confirm').value = '';
        navigation.setView('tasks');
    }
};

// --- TODO MODULE ---
const todo = {
    handleSubmit: (e) => {
        e.preventDefault();
        const text = document.getElementById('new-todo-text').value.trim();
        const priority = document.getElementById('new-todo-priority').value;
        const category = document.getElementById('new-todo-category').value;
        const dueDate = document.getElementById('new-todo-date').value; // Get due date

        if (!text) return;

        const newTask = {
            id: Date.now(),
            userId: state.user.id,
            text,
            priority,
            category,
            dueDate: dueDate || null, // Store due date
            completed: false,
            createdAt: new Date().toISOString(),
            subtasks: []
        };

        state.todos.unshift(newTask);
        todo.save();
        todo.render();
        ui.showToast('Nova meta estratégica definida.', 'success');
        document.getElementById('new-todo-text').value = '';
        document.getElementById('new-todo-date').value = ''; // Clear date input
        gamification.awardXP(50, 'Meta Definida');
        gamification.pushTicker(`NOVA DIRETIVA: ${newTask.text.substring(0, 20)}...`);
        ui.updateStrategicAura();
        ui.playSound('click');
    },

    toggle: (id) => {
        state.todos = state.todos.map(t => {
            if (t.id === id) {
                const completed = !t.completed;
                if (completed) {
                    try {
                        ui.showToast('Vitória confirmada!', 'success');
                        ui.playSound('success');
                        confetti({ particleCount: 40, spread: 50, origin: { y: 0.8 } });
                        gamification.awardXP(200, 'Vitória Confirmada');
                        gamification.pushTicker(`OBJETIVO ALCANÇADO: ${t.text.substring(0, 20)}...`);
                        ui.updateStrategicAura();
                        stats.incrementStreak();
                    } catch (e) {
                        console.error('Gamification/UI Error:', e);
                    }
                    return { ...t, completed, completedAt: new Date().toISOString() };
                }
                return { ...t, completed, completedAt: null };
            }
            return t;
        });
        todo.save();
        todo.render();
    },

    delete: (id) => {
        state.todos = state.todos.filter(t => t.id !== id);
        todo.save();
        todo.render();
        ui.showToast('Tarefa removida.', 'info');
    },

    load: () => {
        const key = `todos_${state.user.id}`;
        state.todos = JSON.parse(localStorage.getItem(key)) || [];
    },

    save: () => {
        const key = `todos_${state.user.id}`;
        localStorage.setItem(key, JSON.stringify(state.todos));
        stats.update();
    },

    render: () => {
        const container = document.getElementById('todo-list');
        container.innerHTML = '';

        const filtered = state.todos.filter(t => {
            const matchSearch = t.text.toLowerCase().includes(state.searchQuery.toLowerCase());
            const matchFilter = state.filter === 'all' ? true :
                (state.filter === 'active' ? !t.completed : t.completed);

            return matchSearch && matchFilter;
        });

        if (filtered.length === 0) {
            container.innerHTML = `
                <div class="py-20 text-center opacity-30 animate-pulse">
                    <i data-lucide="inbox" class="w-16 h-16 mx-auto mb-4"></i>
                    <p class="font-bold uppercase tracking-widest text-sm">Sem tarefas nestes parâmetros</p>
                </div>
            `;
            lucide.createIcons();
            return;
        }

        filtered.forEach((t, index) => {
            const card = document.createElement('div');
            card.className = `todo-item border border-border-soft ${t.completed ? 'opacity-40' : ''}`;
            card.draggable = true;
            card.dataset.id = t.id;
            card.dataset.index = index;

            // Drag event handlers
            card.addEventListener('dragstart', todo.handleDragStart);
            card.addEventListener('dragover', todo.handleDragOver);
            card.addEventListener('drop', todo.handleDrop);
            card.addEventListener('dragend', todo.handleDragEnd);

            card.innerHTML = `
                <div onclick="todo.toggle(${t.id})" class="checkbox-elite ${t.completed ? 'checked' : ''} mt-1"></div>
                
                <div class="flex-grow space-y-3">
                    <div class="space-y-1">
                        <span contenteditable="true" onblur="todo.updateText(${t.id}, this.innerText)" 
                              class="text-lg font-bold block focus:outline-none ${t.completed ? 'line-through text-slate-600' : 'text-white'}">
                            ${t.text}
                        </span>
                        <div class="flex gap-2">
                            <span class="badge ${t.priority === 'high' ? 'badge-priority-high' : 'badge-priority-normal'}">
                                ${t.priority}
                            </span>
                            <span class="badge" style="color: #64748b;">
                                ${t.category}
                            </span>
                            ${t.dueDate ? (() => {
                    const today = new Date().toDateString();
                    const dueDay = new Date(t.dueDate).toDateString();
                    const isOverdue = new Date(t.dueDate) < new Date() && dueDay !== today;
                    const isToday = dueDay === today;
                    const color = isOverdue ? 'text-accent-danger' : isToday ? 'text-accent-warning' : 'text-slate-500';
                    const formattedDate = new Date(t.dueDate).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' });
                    return `<span class="badge border-none p-0 flex items-center gap-1 ${color}" style="background:transparent;">
                                    <i data-lucide="calendar" class="w-3 h-3"></i> ${formattedDate}
                                </span>`;
                })() : ''}
                        </div>
                    </div>

                    <!-- Subtasks -->
                    <div class="pl-4 border-l-2 border-white/5 space-y-3">
                        <div id="subtasks-${t.id}" class="space-y-2">
                            ${t.subtasks.map(s => `
                                <div class="flex items-center gap-3 group/sub">
                                    <div onclick="todo.toggleSubtask(${t.id}, ${s.id})" class="w-4 h-4 rounded border border-white/20 flex items-center justify-center cursor-pointer ${s.completed ? 'bg-success border-success' : ''}">
                                        ${s.completed ? '<i data-lucide="check" class="w-3 h-3 text-white"></i>' : ''}
                                    </div>
                                    <span class="text-sm font-medium ${s.completed ? 'line-through text-slate-500' : 'text-slate-300'}">${s.text}</span>
                                    <button onclick="todo.deleteSubtask(${t.id}, ${s.id})" class="text-danger opacity-0 group-hover/sub:opacity-100 transition-opacity">×</button>
                                </div>
                            `).join('')}
                        </div>
                        <input onkeydown="todo.handleSubtaskInput(event, ${t.id})" 
                               type="text" placeholder="+ Adicionar sub-objetivo..." 
                               class="bg-transparent text-xs text-slate-500 border-none focus:outline-none focus:text-primary w-full py-1">
                    </div>
                </div>

                <div class="flex flex-col gap-2 opacity-0 group-hover/card:opacity-100 transition-all">
                    <button onclick="todo.edit(${t.id})" class="p-3 glass rounded-xl text-primary hover:bg-primary/10">
                        <i data-lucide="edit-3" class="w-4 h-4"></i>
                    </button>
                    <button onclick="todo.delete(${t.id})" class="p-3 glass rounded-xl text-danger hover:bg-danger/10">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
                </div>
            `;
            container.appendChild(card);
        });

        lucide.createIcons();
    },

    edit: (id) => {
        const task = state.todos.find(t => t.id === id);
        if (!task) return;

        const newText = prompt('Editar objetivo estratégico:', task.text);
        if (newText === null) return;

        const trimmed = newText.trim();
        if (!trimmed) return ui.showToast('O texto não pode estar vazio.', 'warning');

        state.todos = state.todos.map(t => t.id === id ? { ...t, text: trimmed } : t);
        todo.save();
        todo.render();
        ui.showToast('Objetivo atualizado com sucesso.', 'success');
        ui.playSound('click');
    },

    updateText: (id, text) => {
        state.todos = state.todos.map(t => t.id === id ? { ...t, text: text.trim() } : t);
        todo.save();
    },

    handleSubtaskInput: (e, todoId) => {
        if (e.key === 'Enter' && e.target.value.trim()) {
            const text = e.target.value.trim();
            state.todos = state.todos.map(t => {
                if (t.id === todoId) {
                    return { ...t, subtasks: [...t.subtasks, { id: Date.now(), text, completed: false }] };
                }
                return t;
            });
            e.target.value = '';
            todo.save();
            todo.render();
            ui.showToast('Sub-tarefa mapeada.');
            gamification.awardXP(20, 'Sub-tarefa Mapeada');
        }
    },

    toggleSubtask: (todoId, subId) => {
        state.todos = state.todos.map(t => {
            if (t.id === todoId) {
                return {
                    ...t,
                    subtasks: t.subtasks.map(s => {
                        if (s.id === subId) {
                            const completed = !s.completed;
                            if (completed) {
                                gamification.awardXP(50, 'Sub-tarefa Concluída');
                            }
                            return { ...s, completed };
                        }
                        return s;
                    })
                };
            }
            return t;
        });
        todo.save();
        todo.render();
    },

    deleteSubtask: (todoId, subId) => {
        state.todos = state.todos.map(t => {
            if (t.id === todoId) {
                return { ...t, subtasks: t.subtasks.filter(s => s.id !== subId) };
            }
            return t;
        });
        todo.save();
        todo.render();
    },

    setFilter: (f) => {
        state.filter = f;
        document.querySelectorAll('.filter-btn').forEach(b => {
            const isMatch = b.getAttribute('onclick').includes(`'${f}'`);
            b.classList.toggle('active', isMatch);
            b.classList.toggle('text-white', isMatch);
            b.classList.toggle('text-slate-400', !isMatch);
        });
        todo.render();
    },

    filterBySearch: (q) => {
        state.searchQuery = q;
        todo.render();
    },

    // Drag & Drop handlers
    draggedElement: null,

    handleDragStart: (e) => {
        todo.draggedElement = e.currentTarget;
        e.currentTarget.style.opacity = '0.4';
        e.dataTransfer.effectAllowed = 'move';
    },

    handleDragOver: (e) => {
        if (e.preventDefault) e.preventDefault();
        e.dataTransfer.dropEffect = 'move';

        const target = e.currentTarget;
        if (target !== todo.draggedElement) {
            target.style.borderTop = '3px solid #6366f1';
        }
        return false;
    },

    handleDrop: (e) => {
        if (e.stopPropagation) e.stopPropagation();
        e.currentTarget.style.borderTop = '';

        if (todo.draggedElement !== e.currentTarget) {
            const fromIndex = parseInt(todo.draggedElement.dataset.index);
            const toIndex = parseInt(e.currentTarget.dataset.index);

            // Reorder array
            const [movedItem] = state.todos.splice(fromIndex, 1);
            state.todos.splice(toIndex, 0, movedItem);

            todo.save();
            todo.render();
            ui.showToast('Ordem atualizada!', 'info');
        }

        return false;
    },

    handleDragEnd: (e) => {
        e.currentTarget.style.opacity = '1';
        document.querySelectorAll('.todo-item').forEach(item => {
            item.style.borderTop = '';
        });
    },

    exportData: () => {
        const blob = new Blob([JSON.stringify(state.todos, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `prio-elite-export-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        ui.showToast('Backup gerado com sucesso.', 'success');
    }
};

// --- NAVIGATION ---
const navigation = {
    setView: (view) => {
        state.currentView = view;
        const subviews = document.querySelectorAll('.subview');
        subviews.forEach(v => v.classList.add('hidden'));

        const target = document.getElementById(`subview-${view}`);
        if (target) {
            target.classList.remove('hidden');
        }

        // Close sidebar on mobile after selection
        if (window.innerWidth < 1024) {
            const sidebar = document.getElementById('sidebar');
            if (sidebar) sidebar.classList.remove('active');
        }

        // Update Nav UI
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
        });

        // Match button IDs: nav-tasks, nav-ai, nav-settings
        const btnId = view === 'dashboard' ? 'nav-tasks' : `nav-${view}`;
        const navBtn = document.getElementById(btnId);
        if (navBtn) navBtn.classList.add('active');

        if (view === 'settings') ui.populateSettings();
    },

    showView: (viewName) => {
        // Elite Ultra Structural Fix: Views are now children of app-root
        document.querySelectorAll('.view').forEach(v => {
            v.classList.add('hidden');
            v.classList.remove('active');
        });

        const targetView = document.getElementById(`view-${viewName}`);

        if (targetView) {
            targetView.classList.remove('hidden');
            targetView.classList.add('active'); // CSS now handles display: flex
        } else {
            console.error(`Elite Engine: View [view-${viewName}] not found in DOM.`);
        }

        if (viewName === 'dashboard' && state.user) {
            const greeting = document.getElementById('user-greeting');
            const avatar = document.getElementById('user-avatar');
            const streak = document.getElementById('streak-display');

            if (greeting) greeting.innerText = `Bem-vindo, ${state.user.name} 👋`;
            if (avatar) avatar.src = state.user.picture;
            if (streak) streak.innerText = `${state.user.streak} DIAS`;

            gamification.updateUI();
        }
    }
};

// --- POMODORO MODULE ---
const pomodoro = {
    init: () => {
        state.pomo.time = 25 * 60;
        pomodoro.updateDisplay();
    },

    toggle: () => {
        const btn = document.getElementById('pomo-toggle-btn');
        if (state.pomo.running) {
            clearInterval(state.pomo.interval);
            state.pomo.running = false;
            btn.innerText = 'RETOMAR';
            btn.classList.replace('bg-slate-100', 'bg-white');
        } else {
            state.pomo.running = true;
            btn.innerText = 'PAUSAR';
            btn.classList.replace('bg-white', 'bg-slate-100');
            state.pomo.interval = setInterval(() => {
                state.pomo.time--;
                if (state.pomo.time <= 0) {
                    clearInterval(state.pomo.interval);
                    state.pomo.running = false;
                    pomodoro.init();
                    ui.showToast('Ciclo Elite Completo! Pausa obrigatória agora. ☕', 'success');
                    ui.playSound('success');
                    confetti({ particleCount: 200, spread: 100 });
                    gamification.awardXP(100, 'Ciclo Pomodoro Completo');
                }
                pomodoro.updateDisplay();
            }, 1000);
        }
    },

    reset: () => {
        clearInterval(state.pomo.interval);
        state.pomo.running = false;
        pomodoro.init();
        document.getElementById('pomo-toggle-btn').innerText = 'INICIAR';
    },

    updateDisplay: () => {
        const m = Math.floor(state.pomo.time / 60);
        const s = state.pomo.time % 60;
        document.getElementById('pomo-timer').innerText = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
};

// --- STATS & ANALYTICS ---
const stats = {
    update: () => {
        const pending = state.todos.filter(t => !t.completed).length;
        document.getElementById('task-status-text').innerText = `${pending} metas estratégicas pendentes`;
    },

    incrementStreak: () => {
        state.user.streak = (state.user.streak || 0) + 1;
        localStorage.setItem('currentUser', JSON.stringify(state.user));

        // Also update the multi-account record if exists
        const accounts = JSON.parse(localStorage.getItem('google_accounts')) || [];
        const index = accounts.findIndex(a => a.email === state.user.email);
        if (index !== -1) {
            accounts[index].streak = state.user.streak;
            localStorage.setItem('google_accounts', JSON.stringify(accounts));
        }

        document.getElementById('streak-display').innerText = `${state.user.streak} DIAS`;
    },

    renderCharts: () => {
        if (typeof Chart === 'undefined') {
            setTimeout(stats.renderCharts, 500);
            return;
        }

        // --- CHART DEFAULTS ---
        Chart.defaults.color = 'rgba(255, 255, 255, 0.4)';
        Chart.defaults.font.family = "'Inter', sans-serif";
        Chart.defaults.font.weight = '700';
        Chart.defaults.plugins.tooltip.backgroundColor = '#1e1b4b';
        Chart.defaults.plugins.tooltip.padding = 12;

        const userTodos = state.todos;

        // 1. Weekly Efficiency (Completions per day for last 7 days)
        const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
        const last7Days = [];
        const completionData = [];

        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            last7Days.push(days[date.getDay()]);

            const count = userTodos.filter(t => t.completed && t.completedAt && t.completedAt.startsWith(dateStr)).length;
            completionData.push(count);
        }

        const canvasCompletion = document.getElementById('chart-completion');
        if (!canvasCompletion) return;
        const ctxCompletion = canvasCompletion.getContext('2d');
        if (state.charts.completion) state.charts.completion.destroy();

        state.charts.completion = new Chart(ctxCompletion, {
            type: 'line',
            data: {
                labels: last7Days,
                datasets: [{
                    label: 'Metas Concluídas',
                    data: completionData,
                    borderColor: '#6366f1',
                    borderWidth: 3,
                    tension: 0.4,
                    pointBackgroundColor: '#6366f1',
                    fill: { target: 'origin', above: 'rgba(99, 102, 241, 0.1)' }
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, border: { display: false } },
                    x: { grid: { display: false } }
                },
                plugins: { legend: { display: false } }
            }
        });

        // 2. Category Distribution
        const categories = { work: 0, personal: 0, health: 0 };
        userTodos.forEach(t => {
            if (categories[t.category] !== undefined) categories[t.category]++;
        });

        const canvasCat = document.getElementById('chart-categories');
        if (!canvasCat) return;
        const ctxCat = canvasCat.getContext('2d');
        if (state.charts.categories) state.charts.categories.destroy();
        state.charts.categories = new Chart(ctxCat, {
            type: 'doughnut',
            data: {
                labels: ['Trabalho', 'Pessoal', 'Saúde'],
                datasets: [{
                    data: [categories.work, categories.personal, categories.health],
                    backgroundColor: ['#6366f1', '#a78bfa', '#10b981'],
                    hoverOffset: 10,
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom', labels: { color: '#94a3b8', padding: 20, font: { weight: 'bold' } } }
                },
                cutout: '70%'
            }
        });
    }
};

// --- UI UTILS ---
const ui = {
    setup: () => {
        // Global Click listener for ripple/sound
        document.body.addEventListener('click', () => {
            // Optional: global click sound or interaction
        });
    },

    showToast: (msg, type = 'info') => {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        const colors = { success: 'border-success text-success', danger: 'border-danger text-danger', info: 'border-primary text-primary' };

        toast.className = `glass-dark p-5 rounded-2xl shadow-2xl flex items-center gap-4 min-w-[320px] border-l-4 ${colors[type]} toast-animate pointer-events-auto`;
        toast.innerHTML = `<span class="font-bold text-sm tracking-tight text-white">${msg}</span>`;

        container.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(20px)';
            setTimeout(() => toast.remove(), 500);
        }, 3500);
    },

    toggleZen: () => {
        state.zenMode = !state.zenMode;
        const sidebar = document.getElementById('sidebar');
        if (state.zenMode) {
            sidebar.classList.add('hidden');
        } else {
            sidebar.classList.remove('hidden');
        }
    },

    loadSounds: () => {
        ui.sounds = {
            success: new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'),
            click: new Audio('https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3')
        };
        ui.sounds.success.volume = 0.1;
        ui.sounds.click.volume = 0.05;
    },

    playSound: (key) => {
        if (ui.sounds && ui.sounds[key]) {
            ui.sounds[key].cloneNode().play().catch(() => { });
        }
    },

    populateSettings: () => {
        document.getElementById('edit-name').value = state.user.name;
        document.getElementById('edit-email').value = state.user.email;
        document.getElementById('settings-avatar').src = state.user.picture;
    },

    changeAvatar: () => {
        document.getElementById('avatar-upload').click();
    },

    handleAvatarSelect: (event) => {
        const file = event.target.files[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            ui.showToast('Por favor seleciona um ficheiro de imagem.', 'danger');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const dataUrl = e.target.result;
            document.getElementById('settings-avatar').src = dataUrl;
            ui.showToast('Imagem carregada! Não te esqueças de Guardar Alterações.', 'success');
        };
        reader.readAsDataURL(file);
    },

    setTheme: (mode) => {
        document.body.classList.toggle('light', mode === 'light');
        document.body.classList.toggle('dark', mode === 'dark');

        if (state.user) {
            const themeKey = `theme_${state.user.id}`;
            localStorage.setItem(themeKey, mode);
        }

        ui.showToast(`Modo ${mode === 'light' ? 'Solar' : 'Noturno'} ativado.`);
    },

    applyUserTheme: () => {
        if (!state.user) return;
        const themeKey = `theme_${state.user.id}`;
        const savedTheme = localStorage.getItem(themeKey) || 'dark';
        ui.setTheme(savedTheme);
    },

    showAchievement: (title, desc, icon = '🏆') => {
        const overlay = document.getElementById('achievement-reveal');
        document.getElementById('achievement-title').innerText = title;
        document.getElementById('achievement-desc').innerText = desc;
        document.getElementById('achievement-icon').innerText = icon;

        overlay.classList.add('active');
        ui.playSound('success');

        // Elite Confetti Blast
        confetti({
            particleCount: 400,
            spread: 160,
            origin: { y: 0.6 },
            colors: ['#ffd700', '#ffffff', '#6366f1']
        });
    },

    closeAchievement: () => {
        const overlay = document.getElementById('achievement-reveal');
        overlay.classList.remove('active');
        ui.playSound('click');
    },

    setAuthMode: (mode) => {
        state.authMode = mode;
        const isSignup = mode === 'signup';

        // Toggle elements
        const signupFields = document.getElementById('signup-fields');
        const confirmField = document.getElementById('confirm-password-field');
        const submitBtn = document.getElementById('auth-submit-btn');

        if (signupFields) signupFields.classList.toggle('hidden', !isSignup);
        if (confirmField) confirmField.classList.toggle('hidden', !isSignup);
        if (submitBtn) submitBtn.innerText = isSignup ? 'CRIAR CONTA ELITE' : 'INICIAR MISSÃO';

        // Update tabs
        const loginBtn = document.getElementById('btn-mode-login');
        const signupBtn = document.getElementById('btn-mode-signup');

        if (loginBtn) {
            loginBtn.className = isSignup ?
                'flex-grow text-[10px] py-3 rounded-xl text-slate-500 font-black hover:text-white transition-all' :
                'btn-primary flex-grow text-[10px] py-3 rounded-xl bg-accent-primary';
        }

        if (signupBtn) {
            signupBtn.className = isSignup ?
                'btn-primary flex-grow text-[10px] py-3 rounded-xl bg-accent-primary' :
                'flex-grow text-[10px] py-3 rounded-xl text-slate-500 font-black hover:text-white transition-all';
        }
    },

    toggleSidebar: () => {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('mobile-overlay');
        const isActive = sidebar.classList.toggle('active');

        if (isActive) {
            overlay.classList.remove('hidden');
        } else {
            overlay.classList.add('hidden');
        }
    },

    updateStrategicAura: () => {
        const aura = document.getElementById('strategic-aura');
        if (!aura) return;

        const pending = state.todos.filter(t => !t.completed).length;

        aura.classList.remove('high-pressure', 'zen-focus');

        if (state.zenMode) {
            aura.classList.add('zen-focus');
        } else if (pending > 5) {
            aura.classList.add('high-pressure');
        }
    }
};

// --- GAMIFICATION ENGINE ---
const gamification = {
    ranks: [
        { name: 'TRAINEE', minLevel: 1, color: '#94a3b8' },
        { name: 'SPECIALIST', minLevel: 5, color: '#6366f1' },
        { name: 'COMMANDER', minLevel: 10, color: '#10b981' },
        { name: 'ELITE', minLevel: 20, color: '#f59e0b' },
        { name: 'LEGEND', minLevel: 50, color: '#ef4444' }
    ],

    init: () => {
        if (!state.user) return;

        // Load user-specific gamification data
        const key = `gamification_data_${state.user.id}`;
        const savedData = JSON.parse(localStorage.getItem(key));

        if (savedData) {
            state.user.xp = parseInt(savedData.xp) || 0;
            state.user.level = parseInt(savedData.level) || 1;
        }

        if (state.user.xp === undefined || isNaN(state.user.xp)) state.user.xp = 0;
        if (state.user.level === undefined || isNaN(state.user.level)) state.user.level = 1;

        gamification.checkStreak(); // Update streak logic on load
        gamification.updateUI();
        ui.updateStrategicAura();
    },

    awardXP: (amount, reason) => {
        if (!state.user) return;

        const xpToAdd = parseInt(amount) || 0;
        state.user.xp = (parseInt(state.user.xp) || 0) + xpToAdd;

        ui.showToast(`+${xpToAdd} XP: ${reason}`, 'info');

        const nextLevelXP = gamification.getXPForLevel(state.user.level + 1);
        if (state.user.xp >= nextLevelXP) {
            gamification.levelUp();
        }

        gamification.updateUI();
        localStorage.setItem('currentUser', JSON.stringify(state.user));

        // Save to user-specific key for persistence across logins
        const key = `gamification_data_${state.user.id}`;
        localStorage.setItem(key, JSON.stringify({
            xp: state.user.xp,
            level: state.user.level
        }));
    },

    pushTicker: (message) => {
        const ticker = document.getElementById('command-ticker');
        if (!ticker) return;

        const span = document.createElement('span');
        span.innerText = `>> ${new Date().toLocaleTimeString()}: ${message}`;
        ticker.prepend(span);

        // Keep last 10 messages
        if (ticker.children.length > 10) {
            ticker.removeChild(ticker.lastChild);
        }
    },

    checkStreak: () => {
        const today = new Date().toDateString();
        const lastActive = state.user.lastActiveDate;

        if (lastActive === today) return; // Já contou hoje

        if (lastActive) {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);

            if (lastActive === yesterday.toDateString()) {
                // Streak continua
                state.user.streak = (state.user.streak || 0) + 1;
                ui.showToast(`🔥 Streak! ${state.user.streak} dias seguidos!`, 'success');
            } else {
                // Quebrou streak
                if (state.user.streak > 0) {
                    ui.showToast(`🧊 Streak perdido. Recomeça!`, 'warning');
                }
                state.user.streak = 1;
            }
        } else {
            // Primeiro dia
            state.user.streak = 1;
        }

        state.user.lastActiveDate = today;
        gamification.save();
        gamification.updateUI();
    },

    getXPForLevel: (lvl) => {
        if (lvl <= 1) return 0;
        return Math.floor(1000 * Math.pow(1.5, lvl - 2));
    },

    levelUp: () => {
        state.user.level++;
        ui.showAchievement(
            'LEVEL UP!',
            `Subiste para o Nível ${state.user.level}. A tua performance está a atingir patamares lendários.`,
            '🥇'
        );
        notifications.onLevelUp(state.user.level); // Push notification
    },

    updateUI: () => {
        if (!state.user) return;

        try {
            const lvl = parseInt(state.user.level) || 1;
            const currentXP = parseInt(state.user.xp) || 0;
            const prevLevelXP = gamification.getXPForLevel(lvl);
            const nextLevelXP = gamification.getXPForLevel(lvl + 1);

            let progress = ((currentXP - prevLevelXP) / (nextLevelXP - prevLevelXP)) * 100;
            if (isNaN(progress)) progress = 0;
            if (progress > 100) progress = 100;

            const levelEl = document.getElementById('user-level');
            const xpBarEl = document.getElementById('xp-bar');
            const lvlSubEl = document.getElementById('lvl-display-sub');
            const xpSubEl = document.getElementById('xp-display-sub');
            const rankEl = document.getElementById('user-rank'); // Optional if it exists

            if (levelEl) levelEl.innerText = `LVL.${lvl}`;
            if (xpBarEl) xpBarEl.style.width = `${progress}%`;
            if (lvlSubEl) lvlSubEl.innerText = lvl;
            if (xpSubEl) xpSubEl.innerText = currentXP;

            // Update Streak Display
            const streakEl = document.getElementById('streak-display');
            if (streakEl) {
                const streak = state.user.streak || 0;
                streakEl.innerText = `${streak} DIAS`;
                // Optional: Change color if streak is high
                if (streak > 3) streakEl.parentElement.classList.add('animate-pulse');
            }

            // Update Rank
            const rank = [...gamification.ranks].reverse().find(r => lvl >= r.minLevel) || gamification.ranks[0];
            if (rankEl) {
                rankEl.innerText = rank.name;
                rankEl.style.color = rank.color;
            }
        } catch (e) {
            console.error('Gamification UI Update Error:', e);
        }
    }
};

// --- BOSS MODE (FOCUS PROTECTION) ---
const bossMode = {
    active: false,
    penaltyInterval: null,

    enable: () => {
        bossMode.active = true;
        document.addEventListener('visibilitychange', bossMode.check);
        ui.showToast('BOSS MODE ATIVADO. Não saias daqui!', 'warning');
        gamification.pushTicker("SISTEMA: Protocolo de Foco Máximo Iniciado.");
    },

    disable: () => {
        bossMode.active = false;
        document.removeEventListener('visibilitychange', bossMode.check);
        clearInterval(bossMode.penaltyInterval);
        document.getElementById('boss-overlay').classList.add('hidden');
    },

    check: () => {
        if (!bossMode.active) return;

        if (document.hidden) {
            // User left the tab
            document.title = "VOLTA JÁ!!! 😡";
            ui.playSound('error');

            // Start Penalty
            bossMode.penaltyInterval = setInterval(() => {
                if (state.user.xp > 0) {
                    state.user.xp -= 10;
                    if (state.user.xp < 0) state.user.xp = 0;
                    gamification.save();
                    gamification.updateUI();
                }
            }, 1000);

        } else {
            // User returned
            document.title = "Priority Elite Ultra";
            document.getElementById('boss-overlay').classList.remove('hidden');
            clearInterval(bossMode.penaltyInterval);
        }
    },

    forgive: () => {
        document.getElementById('boss-overlay').classList.add('hidden');
        ui.showToast('Foco restaurado. Não voltes a falhar.', 'success');
        ui.playSound('click');
    }
};

// --- VOICE INTELLIGENCE ---
const voice = {
    recognition: null,
    active: false,
    target: 'task', // 'task' or 'ai'

    init: () => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) return console.warn('Speech Recognition not supported');

        voice.recognition = new SpeechRecognition();
        voice.recognition.lang = 'pt-PT';
        voice.recognition.continuous = false;
        voice.recognition.interimResults = false;

        voice.recognition.onresult = (event) => {
            const text = event.results[0][0].transcript;

            if (voice.target === 'ai') {
                document.getElementById('ai-input').value = text;
                aiAssistant.process(); // Auto-send
            } else {
                document.getElementById('new-todo-text').value = text;
                ui.showToast(`Voz detectada: "${text}"`, 'info');
            }
            voice.stop();
        };

        voice.recognition.onend = () => voice.stop();
        voice.recognition.onerror = () => voice.stop();
    },

    start: (target = 'task') => {
        if (!voice.recognition) voice.init();
        if (!voice.recognition) return ui.showToast('Browser não suporta voz.', 'warning');

        if (voice.active) return voice.stop();

        voice.target = target;
        voice.active = true;

        // Update correct button UI
        if (target === 'ai') {
            document.getElementById('ai-voice-btn').classList.add('active');
        } else {
            document.getElementById('voice-btn').classList.add('active');
        }

        voice.recognition.start();
        ui.showToast('Ouvindo...', 'info');
    },

    stop: () => {
        voice.active = false;
        document.getElementById('voice-btn')?.classList.remove('active');
        document.getElementById('ai-voice-btn')?.classList.remove('active');

        if (voice.recognition) {
            try { voice.recognition.stop(); } catch (e) { }
        }
    }
};

// --- ELITE NATIVE BRAIN (LOCAL INTELLIGENCE) ---
const aiAssistant = {
    isOpen: false,

    toggle: () => {
        const panel = document.getElementById('ai-chat-panel');
        aiAssistant.isOpen = !aiAssistant.isOpen;

        if (aiAssistant.isOpen) {
            panel.classList.remove('hidden');
            setTimeout(() => {
                panel.classList.remove('translate-y-4', 'opacity-0', 'scale-90');
                document.getElementById('ai-input').focus();
            }, 10);
            ui.playSound('click');
        } else {
            panel.classList.add('translate-y-4', 'opacity-0', 'scale-90');
            setTimeout(() => panel.classList.add('hidden'), 300);
        }
    },

    saveKey: () => {
        ui.showToast('O sistema agora usa Inteligência Nativa. Não são necessárias chaves!', 'info');
    },

    process: () => {
        const input = document.getElementById('ai-input');
        const text = input.value.trim();
        if (!text) return;

        aiAssistant.addMessage('user', text);
        input.value = '';

        const thinkingId = aiAssistant.addThinking();

        setTimeout(() => {
            aiAssistant.removeMessage(thinkingId);
            const response = aiAssistant.nativeBrain(text);
            aiAssistant.addMessage('ai', response);
            ui.playSound('click');
        }, 600);
    },

    speak: (text) => {
        if (!window.speechSynthesis) return;
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'pt-PT';
        utterance.rate = 1.1;
        window.speechSynthesis.speak(utterance);
    },

    nativeBrain: (text) => {
        const lower = text.toLowerCase();

        // --- 0. TASK READING (TTS) ---
        if (lower.includes('tarefas') && (lower.includes('quais') || lower.includes('ler') || lower.includes('minhas'))) {
            const activeTasks = state.todos.filter(t => !t.completed);
            if (activeTasks.length === 0) {
                const response = "Não tens tarefas pendentes. Bom trabalho, Comandante.";
                aiAssistant.speak(response);
                return response;
            }

            const count = activeTasks.length;
            const top3 = activeTasks.slice(0, 3).map(t => t.text).join('. ');
            const response = `Tens ${count} tarefas pendentes. As principais são: ${top3}.`;

            aiAssistant.speak(response);
            return response;
        }

        // --- 1. TASK MANAGEMENT ---
        // Relaxed matching: looks for keywords anywhere, not just at start
        if (lower.match(/adicionar|nova|criar|tarefa|meta|objetivo/)) {
            try {
                const taskText = text.replace(/adicionar|nova|criar|tarefa|meta|objetivo|:|-/gi, '').trim();

                if (taskText) {
                    // Auto-detect priority
                    let priority = 'medium';
                    if (lower.includes('urgente') || lower.includes('importante') || lower.includes('agora')) priority = 'high';
                    if (lower.includes('depois') || lower.includes('leve')) priority = 'low';

                    // Auto-detect category
                    let category = 'work';
                    if (lower.match(/pessoal|casa|lazer|filme/)) category = 'personal';
                    if (lower.match(/saúde|treino|ginásio|água|médico/)) category = 'health';

                    let cleanText = taskText
                        .replace(/urgente|importante|agora|depois|leve/gi, '')
                        .replace(/pessoal|casa|lazer|saúde|treino|ginásio|água|médico/gi, '')
                        .trim();

                    // Fallback: If stripping keywords leaves nothing (e.g. "Criar tarefa Ginásio"), use original
                    if (!cleanText || cleanText.length < 2) {
                        cleanText = taskText;
                    }

                    const newTask = {
                        id: Date.now(),
                        userId: state.user?.id || 'guest',
                        text: cleanText.charAt(0).toUpperCase() + cleanText.slice(1),
                        priority: priority,
                        category: category,
                        completed: false,
                        createdAt: new Date().toISOString(),
                        subtasks: []
                    };

                    state.todos.unshift(newTask);
                    todo.save();
                    todo.render();
                    gamification.pushTicker(`BRAIN: Tarefa criada.`);
                    ui.updateStrategicAura();

                    const response = `Tarefa criada: "${cleanText}" (${category === 'work' ? 'Trabalho' : category === 'personal' ? 'Pessoal' : 'Saúde'}).`;
                    aiAssistant.speak(response);
                    return response;
                }
            } catch (error) {
                console.error("Native Brain Error:", error);
                return "Erro ao criar tarefa. Tenta dizer apenas: 'Criar tarefa [nome]'.";
            }
            return "Comando incompleto. Diz algo como: 'Criar tarefa urgente: Terminar relatório'.";
        }

        if (lower.includes('limpar') && (lower.includes('feitas') || lower.includes('concluídas'))) {
            const initialCount = state.todos.length;
            state.todos = state.todos.filter(t => !t.completed);
            const removed = initialCount - state.todos.length;
            todo.save();
            todo.render();
            const response = `Limpeza efetuada. Removi ${removed} tarefas completas do sistema.`;
            aiAssistant.speak(response);
            return response;
        }

        // --- 2. GAMIFICATION & STATUS ---
        if (lower.includes('nível') || lower.includes('lvl') || lower.includes('xp')) {
            const nextLevel = gamification.getXPForLevel(state.user.level + 1);
            const response = `Nível ${state.user.level}. Tens ${state.user.xp} de experiência. Continua a evoluir.`;
            aiAssistant.speak(response);
            return `Status Atual:\n🏆 Nível: ${state.user.level}\n⚡ XP: ${state.user.xp} / ${nextLevel}\nEstás no caminho certo, Comandante.`;
        }

        // --- 3. MOTIVATION & COACHING ---
        if (lower.includes('cansado') || lower.includes('desmotivado') || lower.includes('difícil')) {
            const quotes = [
                "O descanso faz parte do treino. Faz uma pausa de 5 minutos.",
                "A disciplina leva-te onde a motivação não consegue.",
                "Mantém o foco no próximo passo.",
                "Respira fundo. Organiza as ideias."
            ];
            const quote = quotes[Math.floor(Math.random() * quotes.length)];
            aiAssistant.speak(quote);
            return quote;
        }

        if (lower.includes('foco') || lower.includes('zen') || lower.includes('boss')) {
            bossMode.enable();
            aiAssistant.speak("Boss Mode ativado. Foco total ou morte.");
            return "Protocolo de Boss Mode: ATIVADO. Se saíres daqui, perdes XP. BOA SORTE.";
        }

        if (lower.includes('ajuda') || lower.includes('comandos') || lower.includes('olá')) {
            aiAssistant.speak("Sistema Elite Online. Aqui tens os comandos.");
            return `
🟢 **COMANDOS DE VOZ ELITE**

🗣️ **TAREFAS E PRIORIDADES:**
• "Criar tarefa **urgente**: [Nome]" → 🔴 Alta Prioridade
• "Criar tarefa **leve**: [Nome]" → 🟢 Baixa Prioridade
• "Criar tarefa: [Nome]" → 🟡 Média Prioridade

🧠 **OUTROS COMANDOS:**
• "Quais são as minhas tarefas?" (Leitura de tarefas)
• "Limpar concluídas"
• "Qual o meu nível?"
• "Modo Zen"

Diz o comando agora.`;
        }

        return "Comando não reconhecido pelo núcleo nativo. Tenta 'Ajuda' para ver as opções.";
    },

    askGemini: async (prompt) => {
        // Switching to stable v1 API and 'gemini-pro'
        const API_URL = `https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=${aiAssistant.apiKey}`;

        const systemPrompt = `
           You are the "Elite Ultra Co-Pilot", a strategic productivity assistant.
           Your goal is to help the user manage tasks.
           
           IMPORTANT: If the user wants to ADD a task, output a JSON block at the end of your message like this:
           \`\`\`json
           { "action": "add_task", "text": "Task text here", "priority": "high|medium|low", "category": "work|personal|health" }
           \`\`\`

           Keep your responses concise, motivating, and in Portuguese (Portugal).
           Be "Elite": professional but cool.
        `;

        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ text: systemPrompt + "\nUser: " + prompt }]
                    }]
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error?.message || `Erro HTTP ${response.status}`);
            }

            const data = await response.json();
            const aiText = data.candidates[0].content.parts[0].text;

            // Check for JSON actions
            const jsonMatch = aiText.match(/```json\s*(\{.*?\})\s*```/s);
            if (jsonMatch) {
                try {
                    const action = JSON.parse(jsonMatch[1]);
                    if (action.action === 'add_task') {
                        aiAssistant.executeAddTask(action);
                    }
                } catch (e) {
                    console.error('Failed to parse AI action', e);
                }
                // Return text without the JSON block
                return aiText.replace(/```json\s*\{.*?\}\s*```/s, '').trim();
            }

            return aiText;

        } catch (error) {
            console.error('Gemini API Error:', error);
            if (window.location.protocol === 'file:') {
                return `Erro de conexão (Protocolo Inválido). Estás a abrir o ficheiro diretamente via file://. Usa um servidor local (Live Server). Detalhe: ${error.message}`;
            }
            return `Erro no Cérebro Central: ${error.message}. Verifica a tua API Key.`;
        }
    },

    executeAddTask: (action) => {
        const newTask = {
            id: Date.now(),
            userId: state.user?.id || 'guest',
            text: action.text,
            priority: action.priority || 'medium',
            category: action.category || 'work',
            completed: false,
            createdAt: new Date().toISOString(),
            subtasks: []
        };

        state.todos.unshift(newTask);
        todo.save();
        todo.render();
        ui.updateStrategicAura();
        gamification.pushTicker(`AI: Tarefa criada - ${action.text}`);
    },

    simulateBrain: (text) => {
        const lower = text.toLowerCase();

        // 1. Task Creation (Legacy Fallback)
        if (lower.startsWith('adicionar') || lower.startsWith('criar')) {
            const taskText = text.replace(/adicionar|criar|tarefa|meta|objetivo/gi, '').trim();
            if (taskText) {
                aiAssistant.executeAddTask({ text: taskText });
                return `(Simulação) Adicionei "${taskText}" à lista. Para mais inteligência, ativa o Gemini.`;
            }
        }
        // Default
        return "Estou em modo de simulação limitada. Adiciona a tua API Key nas definições para me libertares totalmente.";
    },

    addMessage: (role, text) => {
        const container = document.getElementById('ai-messages');
        const div = document.createElement('div');
        div.className = `flex gap-4 animate-in fade-in slide-in-from-bottom-2 ${role === 'user' ? 'flex-row-reverse' : ''}`;

        const avatar = role === 'ai'
            ? `<div class="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0 border border-primary/30"><i data-lucide="bot" class="w-4 h-4 text-primary"></i></div>`
            : `<div class="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0"><i data-lucide="user" class="w-4 h-4 text-white"></i></div>`;

        const bubble = role === 'ai'
            ? `bg-white/5 border-white/5 text-slate-300`
            : `bg-primary/20 border-primary/30 text-white`;

        div.innerHTML = `
            ${avatar}
            <div class="${bubble} p-3 rounded-2xl ${role === 'ai' ? 'rounded-tl-none' : 'rounded-tr-none'} border text-sm max-w-[80%] leading-relaxed whitespace-pre-wrap">${text}</div>
        `;

        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
        lucide.createIcons();
        return div.id = 'msg-' + Date.now();
    },

    addThinking: () => {
        const container = document.getElementById('ai-messages');
        const div = document.createElement('div');
        div.id = 'thinking-' + Date.now();
        div.className = "flex gap-4 animate-pulse";
        div.innerHTML = `
            <div class="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0 border border-primary/30"><i data-lucide="bot" class="w-4 h-4 text-primary"></i></div>
            <div class="bg-white/5 p-3 rounded-2xl rounded-tl-none border border-white/5 flex gap-1 items-center h-10">
                <div class="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></div>
                <div class="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-75"></div>
                <div class="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-150"></div>
            </div>
        `;
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
        lucide.createIcons();
        return div.id;
    },

    removeMessage: (id) => {
        const el = document.getElementById(id);
        if (el) el.remove();
    }
};

// --- BOOTSTRAP ---
window.onload = init
