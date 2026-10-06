/**
 * Publishing Status is the JobOrder field `isPublic`.
 * Search matches it as 1. `isPublic:true` matches nothing in this corp.
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
	'customText12',
	'customText10',
	'address(city,state,countryName)',
	'publishedCategory(id,name)',
	'correlatedCustomTextBlock1',
	'customDate1',
	'dateLastPublished',
	'isOpen',
	'isPublic',
	'isDeleted',
].join(',');

export const DETAIL_FIELDS = `${LIST_FIELDS},publicDescription`;

export const PUBLISHED_QUERY = 'isOpen:true AND isDeleted:false AND isPublic:1';
