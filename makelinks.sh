#!/bin/bash

libfiles=("lib/"*)
vendorfiles=("lib/vendor/"*)
imagesfiles=("lib/images/"*)
sitesfiles=("lib/sites/"*)
files=("${libfiles[@]}" "${vendorfiles[@]}" "${imagesfiles[@]}" "${sitesfiles[@]}")

paths=("Chrome" "Firefox/data" "Opera" "OperaBlink" "Safari.safariextension")

for i in "${files[@]}"
do
	for j in "${paths[@]}"
	do
		if [[ -f $i ]]
		then
			file=$(basename $i)
			dir=$(dirname $i)

			if [ "$dir" == "lib/sites" ]
			then
				dest="./$j/sites/"
			elif [ "$dir" == "lib/vendor" ]
			then
				dest="./$j/vendor/"
			elif [ "$dir" == "lib/images" ]
			then
				dest="./$j/images/"
			else
				dest="./$j/"
			fi

			echo "Re-linking:" $dest$file

			if [ -f $dest$file ]
			then
				rm $dest$file
			fi

			if [ "clean" != "$1" ]
			then
				mkdir -p $dest
				ln ./$i $dest
			fi
		fi
	done
done
