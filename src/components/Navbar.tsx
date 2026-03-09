"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus, Search } from "lucide-react";
import Image from "next/image";
import { useSearch } from "./SearchContext";

export default function Navbar() {
  const { searchQuery, setSearchQuery } = useSearch();
  const pathname = usePathname();

  const isExperimentsSection = pathname.startsWith("/my-experiments");
  const placeholder = isExperimentsSection
    ? "Search experiments..."
    : "Search studies...";

  return (
    <nav className="sticky top-0 z-50 bg-white border-b border-gray-200">
      <div className="px-4 h-12 flex items-center gap-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 font-bold text-lg shrink-0">
          <Image src="/site-logo.svg" alt="Archimedes logo" width={32} height={32} />
          <span className="text-gray-900 hidden sm:inline">Archimedes</span>
        </Link>

        {/* Search bar */}
        <div className="flex-1 max-w-xl mx-auto">
          <div className="relative group rounded-full bg-gray-200 p-[1.5px] transition-all duration-300 focus-within:bg-gradient-to-r focus-within:from-teal-400 focus-within:via-blue-500 focus-within:to-purple-500">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder={placeholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-1.5 bg-gray-100 rounded-full text-sm focus:outline-none focus:bg-white transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <Link
            href="/submit"
            className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-semibold text-white bg-orange-500 rounded-full hover:bg-orange-600 transition-colors"
          >
            <Plus size={16} />
            <span className="hidden sm:inline">Submit</span>
          </Link>
        </div>
      </div>
    </nav>
  );
}
