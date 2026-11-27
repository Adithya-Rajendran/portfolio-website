// The globals that the site and its review pages set on window for the tests.
interface Window {
  __modules?: any;
  __lobby?: any;
  __station?: import('./engine/types.ts').Station;
  __bp?: { ready(): boolean };
}
