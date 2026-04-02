"use client"

import { LazyMotion, domAnimation, m } from "framer-motion"
import { useEffect } from "react"

export default function Template({ children }: { children: React.ReactNode }) {
    // Force scroll to top on page transition
    useEffect(() => {
        window.scrollTo(0, 0)
    }, [])

    return (
        <LazyMotion features={domAnimation}>
            <m.div
                initial={{ opacity: 0, y: 15, filter: "blur(5px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)", transitionEnd: { transform: "none", filter: "none" } }}
                exit={{ opacity: 0, y: -15, filter: "blur(5px)" }}
                transition={{
                    type: "spring",
                    stiffness: 100,
                    damping: 20,
                    mass: 1,
                    duration: 0.6
                }}
            >
                {children}
            </m.div>
        </LazyMotion>
    )
}
