// selftest-sleep.mjs <seconds> [exit code]: does nothing for a while, then exits with the code. A stand-in step for tools/check-selftest.sh.
await new Promise((r) => setTimeout(r, Number(process.argv[2] ?? 1) * 1000));
process.exit(Number(process.argv[3] ?? 0));
