import { useEffect, useState, createContext, useContext } from 'react';

type RouterContextType = {
  path: string;
  navigate: (to: string) => void;
};

const RouterContext = createContext<RouterContextType>({ path: '/', navigate: () => {} });

export function useRouter() {
  return useContext(RouterContext);
}

export function navigate(to: string) {
  const next = to.startsWith('/') ? to : `/${to}`;
  window.history.pushState({}, '', next);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function RouterProvider({ children }: { children: React.ReactNode }) {
  const [path, setPath] = useState(() => {
    const h = window.location.hash.replace(/^#/, '');
    return h || window.location.pathname || '/';
  });

  useEffect(() => {
    const onChange = () => {
      const h = window.location.hash.replace(/^#/, '') || '/';
      setPath(h !== '/' ? h : window.location.pathname || '/');
      window.scrollTo(0, 0);
    };
    const onPop = () => {
      const h = window.location.hash.replace(/^#/, '');
      setPath(h || window.location.pathname || '/');
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onChange);
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('hashchange', onChange);
      window.removeEventListener('popstate', onPop);
    };
  }, []);

  return (
    <RouterContext.Provider value={{ path, navigate }}>
      {children}
    </RouterContext.Provider>
  );
}

export function Link({
  to,
  children,
  className,
  onClick,
}: {
  to: string;
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  const href = to.startsWith('/') ? to : `/${to}`;
  return (
    <a
      href={href}
      className={className}
      onClick={(event) => {
        event.preventDefault();
        navigate(to);
        onClick?.();
      }}
    >
      {children}
    </a>
  );
}
