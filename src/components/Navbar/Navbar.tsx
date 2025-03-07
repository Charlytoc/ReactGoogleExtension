import "./Navbar.css";

export const Navbar = () => {
  return (
    <div className="navbar">
      <h1 className="text-center flex-row align-center gap-5 justify-center">
        <img src="icons/icon.png" alt="logo" />
        <div className="share-tech-mono">Automator</div>
      </h1>
    </div>
  );
};
