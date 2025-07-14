
document.addEventListener("DOMContentLoaded", function() {
    
        const loginbtn = document.querySelector('.login-button');
        const userName = document.getElementById('username');
        const password = document.getElementById('password');
        


        loginbtn.addEventListener('click',function(e) {
            e.preventDefault();//prevent automatic form submition 
        const userNameValue = userName.value.trim();
        const passwordValue = password.value.trim();
        
        
        //validate user inputs
        //check if the username and password are entered 
        if(userNameValue==='' || passwordValue===''){
            alert("Please enter a username and password");
            return;
        }

        //check if username contains numbers
        if (/\d/.test(userNameValue)){
            alert("Username cannot contain numbers");
            return;

        }

        window.location.href='./sales-dashboard.html';
        });

});