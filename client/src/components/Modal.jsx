export default function Modal({ title, message, onConfirm, onCancel }) {
  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-title">{title}</div>
        <div className="modal-body">{message}</div>
        <div className="modal-footer">
          <button className="btn" onClick={onCancel}>ยกเลิก</button>
          <button className="btn btn-primary" onClick={onConfirm}>ยืนยัน</button>
        </div>
      </div>
    </div>
  );
}
