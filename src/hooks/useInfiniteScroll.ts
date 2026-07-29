import { useEffect, useRef } from 'react';

interface UseInfiniteScrollOptions {
    onIntersect: () => void;
    enabled: boolean;
    rootMargin?: string;
}

export function useInfiniteScroll({
    onIntersect,
    enabled,
    rootMargin = '100px'
}: UseInfiniteScrollOptions) {
    const observerRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!enabled || !observerRef.current) return;

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) {
                    onIntersect();
                }
            },
            { rootMargin }
        );

        observer.observe(observerRef.current);

        return () => observer.disconnect();
    }, [enabled, onIntersect, rootMargin]);

    return { observerRef };
}
