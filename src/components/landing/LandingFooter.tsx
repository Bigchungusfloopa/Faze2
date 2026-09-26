export default function LandingFooter() {
  return (
    <footer className="w-full h-16 bg-card border-t-2 border-foreground flex items-center">
      <div className="max-w-[1280px] mx-auto px-4 md:px-8 w-full flex items-center justify-between">
        <span className="font-display font-extrabold tracking-tighter text-foreground uppercase">
          MODULUS
        </span>
        <span className="font-sans text-sm text-muted-foreground">
          Built for students.
        </span>
      </div>
    </footer>
  );
}
