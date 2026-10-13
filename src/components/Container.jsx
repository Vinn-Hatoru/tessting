/**
 * Shared page container — keeps horizontal rhythm consistent site-wide.
 */
export default function Container({ className = "", children }) {
  return (
    <div className={`mx-auto w-full max-w-7xl min-w-0 px-4 sm:px-6 lg:px-8 ${className}`}>
      {children}
    </div>
  );
}
