document.addEventListener('DOMContentLoaded', function() {
    const submitbtn = document.getElementById('create-account');
    const newUserName = document.getElementById('new-username');
    const newUserEmail = document.getElementById('new-email');
    const newUserPassword = document.getElementById('new-password');
    const confirmPassword = document.getElementById('confirm-password');
    
    submitbtn.addEventListener('click', function(e) {
        e.preventDefault();
        
    const userNameValue = newUserName.value.trim();
    const userEmailValue = newUserEmail.value.trim();
    const userPasswordValue = newUserPassword.value.trim();
    const confirmPasswordValue = confirmPassword.value.trim();

    //check if alll the fields are filled in 
    if (userNameValue === '' || userEmailValue === '' || 
        userPasswordValue === '' || confirmPasswordValue === '') {
        alert('Please fill in all the fields.');
        return;
    }

    //check if password and confirm password match
    if (userPasswordValue !== confirmPasswordValue) {
        alert('Passwords do not match.');
        return;
    }

    //check if password is more not less than 8 characters 
        if (userPasswordValue.length < 8) {
        alert('Password must be at least 8 characters long.');
        return;
    }


    //check if the email follows the email formart
    if(userEmailValue.indexOf('@') === -1 || userEmailValue.indexOf('.') === -1) {
        alert('Please enter a valid email address.');
        return;
    }

    alert('Account created successfully!');
    

})});