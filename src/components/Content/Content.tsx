import { Button } from "../Button/Button";
import { SVGS } from "../../assets/svgs";
import { useNavigate } from "react-router";

export const Content = () => {
  const navigate = useNavigate();

  return (
    <div>
      <div className="content-container">
        <div className="flex-row gap-10 justify-center padding-10 ">
          <Button
            text="Notes"
            className="padding-20"
            svg={SVGS.note}
            onClick={() => navigate("/notes")}
          />
          <Button
            text="Tasks"
            className="padding-20"
            svg={SVGS.task}
            onClick={() => navigate("/tasks")}
          />
        </div>
      </div>
    </div>
  );
};
