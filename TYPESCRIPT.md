We will convert all js files in the repository to typescript.

Plan:

1. Pick a file to convert, starting from small files.
2. Rename the file to .ts, using mv.
3. Check for typescript errors using tsc.
4. Fix the errors. Do not use any or @ts-ignore, unless absolutely necessary.
5. Run tests.
6. Repeat until all files are converted.

Only advance to the next file once tests are passing and tsc reports no errors.

Do not introduce new functionality or features.
Do not write new comments, except to ignore typescript errors.

Use bun as the package manager, and bun tsc for checking for errors.
