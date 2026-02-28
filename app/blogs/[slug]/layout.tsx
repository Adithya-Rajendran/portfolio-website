export default function MdxLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="max-w-4xl mx-auto">
            <div className="bg-white border border-emerald-200 shadow-sm overflow-hidden sm:rounded-lg dark:bg-white/[0.03] dark:border-white/8">
                <div className="px-4 py-6 md:px-6 lg:py-16 md:py-12">
                    {children}
                </div>
            </div>
        </div>
    );
}
