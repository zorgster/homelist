import { useHousehold } from '../context/HouseholdContext';

export default function Toast() {
  const { toastMsg } = useHousehold();
  return <div id="toast" className={toastMsg ? 'show' : ''}>{toastMsg}</div>;
}
