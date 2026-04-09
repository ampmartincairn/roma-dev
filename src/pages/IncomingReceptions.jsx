import { useOutletContext } from "react-router-dom";
import PageHeader from "../components/wms/PageHeader";
import ReceptionRequestList from "../components/wms/ReceptionRequestList";

export default function IncomingReceptions() {
  const { user, role } = useOutletContext();

  return (
    <div>
      <PageHeader
        title="Приемка товара"
        description="Управление заявками на приемку товара на склад"
      />
      <ReceptionRequestList 
        receptionType="приемка"
        user={user}
        role={role}
        title="Приемка товара"
        description="Управление заявками на приемку товара на склад"
      />
    </div>
  );
}
