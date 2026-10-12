package com.example.backend.auth;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = "http://localhost:5173")
public class AuthController {

    private final UserRepository userRepository;

    private final BCryptPasswordEncoder passwordEncoder =
            new BCryptPasswordEncoder();

    public AuthController(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    // ==========================================
    // REGISTER API
    // ==========================================

    @PostMapping("/register")
    public ResponseEntity<Map<String, Object>> register(
            @RequestBody User user) {

        Map<String, Object> response = new HashMap<>();

        String name = user.getName();
        String email = user.getEmail();
        String password = user.getPassword();

        if (name == null || name.isBlank()
                || email == null || email.isBlank()
                || password == null || password.length() < 8) {

            response.put("message",
                    "Name, email and a password of at least 8 characters are required.");

            return ResponseEntity
                    .badRequest()
                    .body(response);
        }

        email = email.trim().toLowerCase();

        if (userRepository.existsByEmail(email)) {

            response.put("message",
                    "An account with this email already exists.");

            return ResponseEntity
                    .status(HttpStatus.CONFLICT)
                    .body(response);
        }

        User newUser = new User();

        newUser.setName(name.trim());
        newUser.setEmail(email);

        // Store the hashed password, never the original password.
        newUser.setPassword(
                passwordEncoder.encode(password)
        );

        userRepository.save(newUser);

        response.put("message",
                "Registration successful. Please sign in.");

        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(response);
    }

    // ==========================================
    // LOGIN API
    // ==========================================

    @PostMapping("/login")
    public ResponseEntity<Map<String, Object>> login(
            @RequestBody User user) {

        Map<String, Object> response = new HashMap<>();

        String email = user.getEmail();
        String password = user.getPassword();

        if (email == null || email.isBlank()
                || password == null || password.isBlank()) {

            response.put("message",
                    "Email and password are required.");

            return ResponseEntity
                    .badRequest()
                    .body(response);
        }

        email = email.trim().toLowerCase();

        User existingUser = userRepository
                .findByEmail(email)
                .orElse(null);

        if (existingUser == null
                || !passwordEncoder.matches(
                        password,
                        existingUser.getPassword())) {

            response.put("message",
                    "Invalid email or password.");

            return ResponseEntity
                    .status(HttpStatus.UNAUTHORIZED)
                    .body(response);
        }

        response.put("message", "Login successful.");

        // Temporary identifier for the frontend integration.
        // This is NOT yet a verified authentication token.
        response.put("token", UUID.randomUUID().toString());

        response.put("name", existingUser.getName());

        return ResponseEntity.ok(response);
    }
}