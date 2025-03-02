import { SVGS } from "../../assets/svgs";
import { Button } from "../Button/Button";
import "./Navbar.css";

export const Navbar = () => {
  return (
    <div className="navbar">
      <h1 className="text-center flex-row align-center gap-5">
        <img src="icons/icon.png" alt="logo" />
        <strong>Automata.ai</strong>
      </h1>
    </div>
  );
};
