/**
 * Standard JobOrder fields set by Bullhorn Actions > Publish.
 * Confirm these against the Client corp when API access arrives:
 * candidate-facing title (`title`), public description, salary, salary unit,
 * and address. Do not add custom fields here.
 */
export const LIST_FIELDS =
	'id,title,employmentType,salary,salaryUnit,address(city,state,countryName),publishedCategory(id,name),dateLastPublished,isOpen,isPublic,isDeleted';

export const DETAIL_FIELDS = `${LIST_FIELDS},publicDescription`;

export const PUBLISHED_QUERY = 'isOpen:true AND isDeleted:false AND isPublic:true';
