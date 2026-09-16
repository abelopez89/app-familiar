import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    /*
     * `lucide-react` y `date-fns` exportan cientos de símbolos desde un
     * único barrel. Sin esto, cada pantalla que importa tres íconos
     * arrastra el módulo entero al chunk del cliente. Con la opción
     * activada, Next reescribe el import a la ruta concreta de cada
     * símbolo y el bundle baja de forma notoria — que es lo que importa
     * en un celular con datos móviles.
     */
    optimizePackageImports: ["lucide-react", "date-fns", "date-fns-tz"],
  },
};

export default nextConfig;
