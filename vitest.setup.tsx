import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

class MockIntersectionObserver {
  observe = vi.fn();
  disconnect = vi.fn();
  unobserve = vi.fn();
}

Object.defineProperty(window, 'IntersectionObserver', {
  writable: true,
  configurable: true,
  value: MockIntersectionObserver
});

Object.defineProperty(global, 'IntersectionObserver', {
  writable: true,
  configurable: true,
  value: MockIntersectionObserver
});

// Mock fetch globally
vi.stubGlobal('fetch', vi.fn().mockImplementation(() => 
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ error: "No mock data configured for this test" }),
  })
));

vi.mock("framer-motion", () => ({
  motion: {
    div: (props: any) => <div {...props} />,
    section: (props: any) => <section {...props} />,
    h1: (props: any) => <h1 {...props} />,
    h2: (props: any) => <h2 {...props} />,
    h3: (props: any) => <h3 {...props} />,
    h4: (props: any) => <h4 {...props} />,
    p: (props: any) => <p {...props} />,
    span: (props: any) => <span {...props} />,
    button: (props: any) => <button {...props} />,
    circle: (props: any) => <circle {...props} />,
    svg: (props: any) => <svg {...props} />,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

afterEach(() => {
  cleanup();
});
