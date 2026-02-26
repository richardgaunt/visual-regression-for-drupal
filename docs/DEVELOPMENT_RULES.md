# Development Rules

Every feature must have it's own commit
Every feature must be completed in a feature branch
Every feature must have a Pull Request in the following format:

Tests must be passing before PR is created - use `npm run test`
Code style must follow eslint rules - use `npm run lint`


Code should be modular, if a function is to be used across different parts of the application, then it should be in `src/lib` in it's own file
If a function can be unit tested then we should be create unit tests with fixtures to ensure the function is working****

