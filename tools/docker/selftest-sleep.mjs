// Stand-in step that sleeps for some seconds and exits with a given code
await new Promise((r) => setTimeout(r, Number(process.argv[2] ?? 1) * 1000));
process.exit(Number(process.argv[3] ?? 0));
