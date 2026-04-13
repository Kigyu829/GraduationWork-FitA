package com.capstone.fitainess;

import android.text.TextUtils;
import android.util.Patterns;

public class InputValidator
{
    public static boolean isValidEmail(String email)
    {
        return !TextUtils.isEmpty(email) && Patterns.EMAIL_ADDRESS.matcher(email).matches();
    }
    public static boolean isValidPassword(String password)
    {
        return password != null && password.length() >= 6;
    }
    public static boolean isPasswordMatch(String password, String confirmPassword)
    {
        return password != null && password.equals(confirmPassword);
    }
}
