import { Button } from "../Button/Button";
import { SVGS } from "../../assets/svgs";
import "./TaskManager.css";
import { Link } from "react-router";
export const TaskManager = () => {
  return (
    <div className="padding-10 flex-column gap-10">
      <h3 className="padding-10 flex-row gap-10 justify-between">
        <Link to="/index.html">
          <Button svg={SVGS.back} />
        </Link>
        <span>Task Manager</span>
      </h3>
    </div>
  );
};
