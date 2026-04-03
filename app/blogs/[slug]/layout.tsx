export default function MdxLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="mx-auto">
            {children}
        </div>
    );
}
