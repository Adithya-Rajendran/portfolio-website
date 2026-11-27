// A stand-in measuring script that never ends, to test the overall deadline of measure-guard.mjs
import { deadline } from './measure-guard.mjs';

deadline('hang', 600000, async () => {});
await new Promise(() => setInterval(() => {}, 1000));
