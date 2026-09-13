import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: "CarMazium",
        short_name: "CarMazium",
        description: "UK car marketplace for buying, selling and auctioning vehicles.",
        start_url: "/",
        display: "standalone",
        background_color: "#ffffff",
        theme_color: "#ed1c24",
        icons: [
            {
                src: "/icon.png",
                sizes: "192x192",
                type: "image/png",
            },
        ],
    }
}
