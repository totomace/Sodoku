document.addEventListener('DOMContentLoaded', () => {
    
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    
    const showRegisterLink = document.getElementById('show-register');
    const showLoginLink = document.getElementById('show-login');

    // --- Logic chuyển đổi form ---
    showRegisterLink.addEventListener('click', () => {
        loginForm.style.display = 'none';
        registerForm.style.display = 'block';
    });

    showLoginLink.addEventListener('click', () => {
        registerForm.style.display = 'none';
        loginForm.style.display = 'block';
    });

    // --- Logic (THẬT) Đăng nhập ---
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault(); 
        const username = document.getElementById('login-username').value;
        const password = document.getElementById('login-password').value;

        const response = await fetch('/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, password }),
        });

        const result = await response.json();

        if (result.success) {
            
            // === PHẦN SỬA LỖI ===
            localStorage.setItem('username', username);
            alert('Đã lưu user! Đang chuyển đến Menu...');
            // === HẾT PHẦN SỬA LỖI ===
            
            window.location.href = '/index.html'; 
        } else {
            alert(result.message); 
        }
    });

    // --- Logic (THẬT) Đăng ký ---
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const username = document.getElementById('reg-username').value;
        const password = document.getElementById('reg-password').value;
        const confirmPassword = document.getElementById('confirm-password').value;

        if (password !== confirmPassword) {
            alert("Mật khẩu nhập lại không khớp!");
            return; 
        }

        const response = await fetch('/api/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, password }),
        });
        
        const result = await response.json();

        if (result.success) {
            alert(result.message); 
            showLoginLink.click(); 
        } else {
            alert(result.message); 
        }
    });
});