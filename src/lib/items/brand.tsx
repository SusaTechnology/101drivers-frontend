import { Link } from "@tanstack/react-router"

export const Brand = () => {
    return  (  
              <Link to="/" className="flex items-center" aria-label="101 Drivers">
                <div className="w-14 h-14 lg:w-16 lg:h-16 rounded-2xl overflow-hidden bg-black flex items-center justify-center shadow-lg shadow-black/10 border border-slate-200">
                  <img
                    src="/assets/101drivers-logo.jpg"
                    alt="101 Drivers"
                    className="w-full h-full object-cover"
                  />
                </div>
              </Link>
    )
}