export default function MdxLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="max-w-4xl mx-auto">
            <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-lg">
                <div className="px-4 py-6 md:px-6 lg:py-16 md:py-12">
                    <div className="grid grid-cols-1 lg:grid-cols-1 gap-6">
                        {children}
                    </div>
                </div>
            </div>
        </div>
    );
}
