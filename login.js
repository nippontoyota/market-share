const loginForm = document.getElementById('loginForm');
const loginButton = document.getElementById('loginButton');
const errorMessage = document.getElementById('errorMessage');

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    // Disable button during request
    loginButton.disabled = true;
    loginButton.textContent = 'Logging in...';
    errorMessage.classList.remove('show');

    try {
        const response = await fetch('/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            window.location.href = data.redirect;
        } else {
            errorMessage.textContent = data.error || 'Invalid username or password';
            errorMessage.classList.add('show');
            loginButton.disabled = false;
            loginButton.textContent = 'Login';
        }
    } catch (error) {
        errorMessage.textContent = 'Connection error. Please try again.';
        errorMessage.classList.add('show');
        loginButton.disabled = false;
        loginButton.textContent = 'Login';
    }
});
