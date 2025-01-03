import { Button } from "../Button/Button";
import { SVGS } from "../../assets/svgs";
import "./TaskManager.css";
import { useNavigate } from "react-router";
import { saveLastPage } from "../../utils/lib";
export const TaskManager = () => {
  const navigate = useNavigate();
  return (
    <div className="padding-10 flex-column gap-10">
      <h3 className=" flex-row gap-10 justify-between">
        <Button
          svg={SVGS.back}
          className="padding-5 active-on-hover"
          onClick={() => {
            saveLastPage("/index.html");
            navigate("/index.html");
          }}
        />
        <span>Task Manager</span>
      </h3>
    </div>
  );
};
