# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - region "Notifications alt+T"
  - generic [ref=e3]:
    - link "BeeSmart" [ref=e4] [cursor=pointer]:
      - /url: /
      - img "BeeSmart" [ref=e5]
    - generic [ref=e9]:
      - button "Google Continue with Google" [ref=e10]:
        - generic [ref=e12]:
          - img "Google" [ref=e13]
          - text: Continue with Google
      - generic [ref=e15]: or
      - generic [ref=e16]:
        - generic [ref=e17]:
          - generic [ref=e18]: Email
          - textbox "Email" [ref=e19]:
            - /placeholder: you@example.com
            - text: teacher@beesmart.ai
        - generic [ref=e20]:
          - generic [ref=e21]: Password
          - textbox "Password" [ref=e22]:
            - /placeholder: ••••••••
            - text: password123
        - button "Sign in" [ref=e23]:
          - generic [ref=e25]: Sign in
    - paragraph [ref=e26]:
      - text: Don't have an account?
      - link "Sign up" [ref=e27] [cursor=pointer]:
        - /url: /register
  - button "Open Next.js Dev Tools" [ref=e33] [cursor=pointer]:
    - img [ref=e34]
  - alert [ref=e37]
```