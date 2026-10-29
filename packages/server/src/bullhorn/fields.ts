/**
 * Publishing Status is the JobOrder field `isPublic`.
 * The picklist value for "Published" is -1. The legacy value 1 is not a
 * picklist option and must not match. An unquoted minus is a Lucene NOT,
 * so the value is quoted. `isPublic:true` matches nothing in this corp.
 * Public title, salary range, hide-salary, worksite, and published date
 * are the Career Group field labels from their job mapping.
 */
export const LIST_FIELDS = [
	'id',
	'title',
	'customText15',
	'employmentType',
	'salary',
	'salaryUnit',
	'customFloat1',
	'customFloat2',
	'customFloat3',
	'payRate',
	'customText12',
	'customText10',
	'address(city,state,zip,countryName)',
	'customText7',
	'customText20',
	'customDate1',
	'dateLastPublished',
	'isOpen',
	'isPublic',
	'isDeleted',
	'customText4',
	'publicDescription',
].join(',');

export const DETAIL_FIELDS = LIST_FIELDS;

export const PUBLISHED_QUERY = 'isDeleted:false AND isPublic:"-1"';

/** Published Date (`customDate1`), newest first. */
export const PUBLISHED_SORT = '-customDate1';
