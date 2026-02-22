/**
 * View-only patient info section.
 */

interface PatientInfoCardProps {
  name: string;
  dateOfBirth?: string;
  mrn?: string;
  email?: string;
  phone?: string;
  notes?: string;
  className?: string;
}

export function PatientInfoCard({
  name,
  dateOfBirth,
  mrn,
  email,
  phone,
  notes,
  className = "",
}: PatientInfoCardProps) {
  return (
    <div className={`rounded-xl border border-clinical-border bg-clinical-surface p-4 ${className}`}>
      <div className="text-xs font-medium text-clinical-muted mb-3">Patient info</div>
      <dl className="grid gap-2 text-sm">
        <div>
          <dt className="text-clinical-muted">Name</dt>
          <dd className="font-medium text-gray-900">{name}</dd>
        </div>
        {dateOfBirth && (
          <div>
            <dt className="text-clinical-muted">Date of birth</dt>
            <dd className="text-gray-800">{dateOfBirth}</dd>
          </div>
        )}
        {mrn && (
          <div>
            <dt className="text-clinical-muted">MRN</dt>
            <dd className="text-gray-800">{mrn}</dd>
          </div>
        )}
        {email && (
          <div>
            <dt className="text-clinical-muted">Email</dt>
            <dd className="text-gray-800">{email}</dd>
          </div>
        )}
        {phone && (
          <div>
            <dt className="text-clinical-muted">Phone</dt>
            <dd className="text-gray-800">{phone}</dd>
          </div>
        )}
        {notes && (
          <div>
            <dt className="text-clinical-muted">Notes</dt>
            <dd className="text-gray-800 whitespace-pre-wrap">{notes}</dd>
          </div>
        )}
      </dl>
    </div>
  );
}
