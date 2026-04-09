import { useOutletContext } from "react-router-dom";
import PageHeader from "../components/wms/PageHeader";
import ReceptionRequestList from "../components/wms/ReceptionRequestList";

export default function IncomingReturns() {
  const { user, role } = useOutletContext();

  return (
    <div>
      <PageHeader
        title="Возвраты товара"
        description="Управление заявками на возвраты товара"
      />
      <ReceptionRequestList 
        receptionType="возврат"
        user={user}
        role={role}
        title="Возвраты товара"
        description="Управление заявками на возвраты товара"
      />
    </div>
  );
}
